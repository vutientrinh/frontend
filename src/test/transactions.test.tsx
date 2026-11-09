import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "./setup";
import { resetDB, getDB } from "../mocks/db";
import { handlers } from "../mocks/handlers";
import OrderForm from "../features/orders/OrderForm";
import PaymentForm from "../features/payments/PaymentForm";
import PaymentDetail from "../features/payments/PaymentDetail";
function mount(path: string) {
  const c = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={c}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/admin/orders/:id" element={<p>Order created</p>} />
          <Route path="/payments/new" element={<PaymentForm />} />
          <Route path="/admin/payments/:id" element={<PaymentDetail />} />
          <Route path="/payments/:id" element={<PaymentDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  resetDB();
  server.use(...handlers);
});
describe("transaction flows", () => {
  it("creates an order with exact item total", async () => {
    const user = userEvent.setup(),
      db = getDB();
    mount("/orders/new");
    await screen.findByRole(
      "heading",
      { name: "Create order" },
      { timeout: 4000 },
    );
    expect(
      (screen.getByLabelText("Order code") as HTMLInputElement).value,
    ).toMatch(/^ORD-/);
    await user.clear(screen.getByLabelText("Order code"));
    await user.type(screen.getByLabelText("Order code"), "ORD-TEST");
    await user.click(screen.getByRole("combobox", { name: "Customer" }));
    await user.type(
      screen.getByPlaceholderText("Search customer"),
      db.customers[0].email,
    );
    await user.click(
      await screen.findByText(new RegExp(db.customers[0].email)),
    );
    await user.click(screen.getByRole("combobox", { name: "Product 1" }));
    await user.type(
      screen.getByPlaceholderText("Search product 1"),
      db.products[0].productName,
    );
    await user.click(await screen.findByText(db.products[0].productName));
    await user.click(screen.getByRole("button", { name: "Create order" }));
    expect(
      await screen.findByText("Order created", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(db.orders[0].orderAmount).toBe(db.products[0].unitPrice);
  });
  it("creates a payment after confirmation", async () => {
    const user = userEvent.setup(),
      db = getDB(),
      order = db.orders.find((o) => o.status === "PENDING")!;
    mount(`/payments/new?orderId=${order.id}`);
    await user.click(
      await screen.findByRole(
        "button",
        { name: "Review payment" },
        { timeout: 4000 },
      ),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirm",
      }),
    );
    expect(
      await screen.findByRole(
        "heading",
        { name: "Payment detail" },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(db.payments.some((p) => p.orderId === order.id)).toBe(true);
    expect(
      within(screen.getByRole("list", { name: "Payment progress" })).getByText(
        "Completed / Failed",
      ),
    ).toBeInTheDocument();
  });
  it("offers only valid transitions and confirms a refund", async () => {
    const user = userEvent.setup(),
      p = getDB().payments[0];
    mount(`/payments/${p.id}`);
    expect(
      await screen.findByRole("button", { name: "Refund" }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole(
        "heading",
        { name: "Order summary" },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy to clipboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark failed" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refund" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirm",
      }),
    );
    expect(
      (await screen.findAllByText("Refunded", {}, { timeout: 4000 })).length,
    ).toBeGreaterThan(0);
  });
  it("shows reached processing and refunded steps from payment history", async () => {
    const db = getDB(),
      payment = db.payments[0];
    payment.status = "REFUNDED";
    db.history[payment.id].push({
      status: "REFUNDED",
      changedAt: payment.updatedAt,
      source: "SYSTEM",
    });
    mount(`/payments/${payment.id}`);
    const progress = await screen.findByRole(
      "list",
      { name: "Payment progress" },
      { timeout: 4000 },
    );
    expect(await within(progress).findByText("Processing")).toBeInTheDocument();
    expect(await within(progress).findAllByText("Reached")).toHaveLength(3);
    expect(
      within(progress).getByText("Refunded").parentElement,
    ).toHaveAttribute("aria-current", "step");
  });
  it("does not claim processing was reached for a direct failure", async () => {
    const db = getDB(),
      payment = db.payments[0];
    payment.status = "FAILED";
    db.history[payment.id] = [
      { status: "PENDING", changedAt: payment.createdAt, source: "SYSTEM" },
      { status: "FAILED", changedAt: payment.updatedAt, source: "SYSTEM" },
    ];
    mount(`/payments/${payment.id}`);
    const progress = await screen.findByRole(
      "list",
      { name: "Payment progress" },
      { timeout: 4000 },
    );
    expect(
      await within(progress).findByText("Not recorded"),
    ).toBeInTheDocument();
    expect(within(progress).getByText("Processing")).toBeInTheDocument();
    expect(within(progress).getByText("Failed").parentElement).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});
