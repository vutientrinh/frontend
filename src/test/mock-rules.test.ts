import { beforeEach, describe, expect, it } from "vitest";
import { advance, handlers } from "../mocks/handlers";
import { getDB, resetDB } from "../mocks/db";
import { server } from "./setup";
const base = new URL("/api", window.location.origin).href;
beforeEach(() => {
  localStorage.clear();
  resetDB();
  server.use(...handlers);
});
const send = (path: string, method: string, data?: unknown) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
describe("stateful mock contract", () => {
  it("validates input and rejects duplicate email", async () => {
    const bad = await send("/customers", "POST", {
      firstName: "",
      lastName: "Test",
      email: "invalid",
      phoneNumber: "123",
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).fieldErrors.length).toBeGreaterThan(0);
    const existing = getDB().customers[0];
    const duplicate = await send("/customers", "POST", {
      ...existing,
      email: existing.email.toUpperCase(),
    });
    expect(duplicate.status).toBe(409);
  });
  it("locks paid orders and rejects a second payment", async () => {
    const payment = getDB().payments[0];
    const order = getDB().orders.find((o) => o.id === payment.orderId)!;
    expect((await send(`/orders/${order.id}`, "DELETE")).status).toBe(409);
    expect(
      (await send("/payments", "POST", { orderId: order.id, method: "CARD" }))
        .status,
    ).toBe(409);
  });
  it("creates readable payments and rejects illegal transitions", async () => {
    const order = getDB().orders.find((o) => o.status === "PENDING")!;
    const response = await send("/payments", "POST", {
      orderId: order.id,
      method: "CARD",
    });
    expect(response.status).toBe(201);
    const payment = await response.json();
    expect(
      (await (await fetch(`${base}/payments/${payment.id}`)).json()).id,
    ).toBe(payment.id);
    expect(
      (
        await send(`/payments/${payment.id}/status`, "PATCH", {
          status: "REFUNDED",
        })
      ).status,
    ).toBe(409);
    expect(
      (await (await fetch(`${base}/payments/${payment.id}/history`)).json())[0]
        .status,
    ).toBe("PENDING");
  });
  it("advances a payment and records history and events", () => {
    const db = getDB();
    const order = db.orders.find((o) => o.status === "PENDING")!;
    const createdAt = new Date(Date.now() - 4000).toISOString();
    db.payments.push({
      id: "simulation",
      orderId: order.id,
      status: "PENDING",
      method: "CARD",
      amount: order.orderAmount,
      currency: "VND",
      createdAt,
      updatedAt: createdAt,
    });
    advance();
    expect(db.payments.at(-1)?.status).toBe("PROCESSING");
    expect(db.history.simulation[0].status).toBe("PROCESSING");
    expect(db.events[0].aggregateId).toBe("simulation");
  });
  it("calculates order amounts with exact decimal arithmetic", async () => {
    const db = getDB();
    db.products[0].unitPrice = "0.1";
    const response = await send("/orders", "POST", {
      orderCode: "TEST",
      customerId: db.customers[0].id,
      items: [{ productId: db.products[0].id, quantity: 3 }],
    });
    expect(response.status).toBe(201);
    expect((await response.json()).orderAmount).toBe("0.3");
  });
});
