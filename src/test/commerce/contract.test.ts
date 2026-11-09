import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../setup";
import { commerceHandlers } from "../../mocks/commerce";
import {
  getDB,
  reloadCommerceDB,
  resetCommerceDB,
} from "../../mocks/commerce/db";
const request = async (
  path: string,
  method = "GET",
  data?: unknown,
  key?: string,
) =>
  fetch(new URL(`/api${path}`, location.origin), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer shopper-token",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
async function checkout() {
  const db = getDB();
  const products = [db.products[1], db.products[2]];
  for (const product of products)
    await request("/cart/items", "POST", {
      variantId: product.variants[0].id,
      quantity: 1,
    });
  const cart = await (await request("/cart")).json();
  const items = cart.groups.flatMap((group: { items: { id: string }[] }) =>
    group.items.map((i) => i.id),
  );
  const shippingOptionIds = Object.fromEntries(
    cart.groups.map((group: { seller: { id: string } }) => [
      group.seller.id,
      "standard",
    ]),
  );
  return request(
    "/checkout",
    "POST",
    {
      cartItemIds: items,
      addressId: "address",
      shippingOptionIds,
      paymentMethod: "VIETQR",
    },
    "checkout-key",
  );
}
beforeEach(() => {
  localStorage.setItem(
    "payment-banking-mock-v3",
    JSON.stringify({
      users: [
        {
          id: "shopper-1",
          phone: "0900000001",
          fullName: "Shopper",
          roles: ["SHOPPER"],
          status: "ACTIVE",
        },
      ],
      sessions: { "shopper-token": "shopper-1" },
      addresses: {},
    }),
  );
  resetCommerceDB();
  server.use(...commerceHandlers);
});
describe("commerce checkout", () => {
  it("splits orders by seller and maps successful payment to paid", async () => {
    const response = await checkout();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sellerOrders).toHaveLength(2);
    const result = await request(
      `/dev/payment-intents/${data.paymentIntent.id}/simulate`,
      "POST",
      { outcome: "SUCCEEDED" },
    );
    expect((await result.json()).status).toBe("SUCCEEDED");
    const orders = await (await request("/me/orders?tab=TO_SHIP")).json();
    expect(
      orders.content.filter(
        (o: { parentOrderId: string }) =>
          o.parentOrderId === data.parentOrderId,
      ),
    ).toHaveLength(2);
    expect(
      orders.content
        .filter(
          (o: { parentOrderId: string }) =>
            o.parentOrderId === data.parentOrderId,
        )
        .every((o: { status: string }) => o.status === "PAID"),
    ).toBe(true);
  });
  it("retains failed reservations for retry and releases them on expiry", async () => {
    const first = getDB().products[1].variants[0];
    const original = first.stock;
    const result = await (await checkout()).json();
    expect(first.stock).toBe(original - 1);
    await request(
      `/dev/payment-intents/${result.paymentIntent.id}/simulate`,
      "POST",
      { outcome: "FAILED" },
    );
    expect(first.stock).toBe(original - 1);
    expect(
      (await (await request("/me/orders?tab=TO_PAY")).json()).content.filter(
        (o: { parentOrderId: string }) =>
          o.parentOrderId === result.parentOrderId,
      ).length,
    ).toBe(2);
    const retry = await (
      await request(
        `/me/orders/${result.parentOrderId}/pay`,
        "POST",
        { paymentMethod: "VIETQR" },
        "retry-key",
      )
    ).json();
    expect(retry.parentOrderId).toBe(result.parentOrderId);
    expect(retry.orderNumber).toBe(result.orderNumber);
    expect(retry.expiresAt).toBe(result.paymentIntent.expiresAt);
    const detail = await (
      await request(`/me/orders/${result.sellerOrders[0].id}`)
    ).json();
    expect(detail.paymentIntentId).toBe(retry.id);
    expect(
      (
        await request(
          `/me/orders/${result.parentOrderId}/pay`,
          "POST",
          { paymentMethod: "VIETQR" },
          "other-key",
        )
      ).status,
    ).toBe(409);
    await request(`/dev/payment-intents/${retry.id}/simulate`, "POST", {
      outcome: "SUCCEEDED",
    });
    expect(
      getDB()
        .orders.filter((o) => o.parentOrderId === result.parentOrderId)
        .every((o) => o.status === "PAID"),
    ).toBe(true);
    resetCommerceDB();
    const second = getDB().products[1].variants[0];
    const stock = second.stock;
    const again = await (await checkout()).json();
    const variantId = second.id;
    reloadCommerceDB();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 900001);
    expect(
      (
        await (
          await request(`/payment-intents/${again.paymentIntent.id}`)
        ).json()
      ).status,
    ).toBe("EXPIRED");
    expect(
      getDB()
        .products.flatMap((p) => p.variants)
        .find((v) => v.id === variantId)?.stock,
    ).toBe(stock + 1); // The seeded reservation for this SKU also expires.
    vi.useRealTimers();
  });
  it("rejects quantities above available stock", async () => {
    const v = getDB().products[1].variants[0];
    expect(
      (
        await request("/cart/items", "POST", {
          variantId: v.id,
          quantity: v.stock + 1,
        })
      ).status,
    ).toBe(422);
  });
  it("expires a failed payment and rejects retries after the reservation deadline", async () => {
    const product = getDB().products[1];
    const stock = product.variants[0].stock;
    const result = await (await checkout()).json();
    await request(
      `/dev/payment-intents/${result.paymentIntent.id}/simulate`,
      "POST",
      { outcome: "FAILED" },
    );
    reloadCommerceDB();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 900001);
    const response = await request(
      `/me/orders/${result.parentOrderId}/pay`,
      "POST",
      { paymentMethod: "VIETQR" },
      "late",
    );
    expect(response.status).toBe(409);
    expect(
      getDB()
        .orders.filter((o) => o.parentOrderId === result.parentOrderId)
        .every((o) => o.status === "CANCELLED"),
    ).toBe(true);
    expect(
      getDB().products.find((p) => p.id === product.id)?.variants[0].stock,
    ).toBe(stock + 1);
    vi.useRealTimers();
  });
});
