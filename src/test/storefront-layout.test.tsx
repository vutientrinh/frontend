import { configure, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../features/banking/AuthContext";
import { setSession } from "../features/banking/client";
import type { Address, Tokens } from "../features/banking/types";
import type { CheckoutResult } from "../features/commerce/types";
import { lineTotal } from "../features/storefront/lib";
import { storefrontRoutes } from "../features/storefront/routes";
import { formatMoney } from "../lib/money";
import { bankingHandlers, resetBanking } from "../mocks/banking";
import { commerceHandlers } from "../mocks/commerce";
import { getDB, resetCommerceDB, saveDB } from "../mocks/commerce/db";
import { server } from "./setup";

/** TASK-025 Part C: checkout without an address, checkout steps, payment hero. */
const LOAD = { timeout: 8000 };
configure({ asyncUtilTimeout: 5000 });
const OWNER = "phone:0900000001";
const url = (path: string) => new URL(`/api${path}`, window.location.origin);
let token = "";

async function call<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const response = await fetch(url(path), {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  expect(response.ok).toBe(true);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/", element: <Outlet />, children: storefrontRoutes }],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

/** One in-stock product line (quantity 2) as the only cart content. */
async function cartWithOneLine() {
  getDB().cart = getDB().cart.filter((i) => i.ownerId !== OWNER);
  saveDB();
  const product = getDB().products.find(
    (p) => p.status === "LIVE" && p.variants.some((v) => v.stock > 2),
  )!;
  const variant = product.variants.find((v) => v.stock > 2)!;
  await call("/cart/items", { body: { variantId: variant.id, quantity: 2 } });
  return { product, total: lineTotal(variant.price, 2) };
}

async function removeAddresses() {
  for (const a of await call<Address[]>("/me/addresses"))
    await call(`/me/addresses/${a.id}`, { method: "DELETE" });
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  resetBanking();
  resetCommerceDB();
  server.use(...commerceHandlers, ...bankingHandlers);
  token = "";
  const tokens = await call<Tokens>("/auth/login", {
    body: { login: "0900000001", password: "demo123" },
  });
  token = tokens.accessToken;
  setSession(tokens);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("W-16 checkout (TASK-025 C1, C2)", () => {
  it("shows items and their subtotal before there is an address, then prices shipping", async () => {
    const user = userEvent.setup();
    await removeAddresses();
    const { product, total } = await cartWithOneLine();
    const intents = getDB().intents.length;
    mount("/checkout");

    // Step 1 is an open address form; step 2 already lists the seller's items.
    const form = await screen.findByRole(
      "group",
      { name: "New address" },
      LOAD,
    );
    const items = screen.getByRole("region", { name: /Items & shipping/ });
    const seller = within(items).getByRole("region", {
      name: product.seller.name,
    });
    expect(within(seller).getByText(product.name)).toBeInTheDocument();
    expect(
      within(seller).getByText(
        "Add a delivery address to see shipping options.",
      ),
    ).toBeInTheDocument();

    // The summary shows the real subtotal (not ₫0) and Place order says why it waits.
    const summary = screen.getByRole("region", { name: "Order summary" });
    expect(within(summary).getByText("Items (2)")).toBeInTheDocument();
    expect(
      within(summary).getAllByLabelText(formatMoney(total, "VND")).length,
    ).toBeGreaterThanOrEqual(2);
    const place = screen.getByRole("button", { name: "Place order" });
    expect(place).toBeDisabled();
    expect(place).toHaveAccessibleDescription(
      "Add a delivery address to place your order.",
    );

    await user.type(within(form).getByLabelText("Recipient"), "Tran Thi B");
    await user.type(within(form).getByLabelText("Phone"), "0912345678");
    await user.type(
      within(form).getByLabelText("Address"),
      "5 Hang Bai, Hanoi{Enter}",
    );
    expect(
      await screen.findByRole("radio", { name: /5 Hang Bai, Hanoi/ }),
    ).toBeChecked();
    expect(
      await within(seller).findByRole("radio", { name: /Express/ }, LOAD),
    ).toBeInTheDocument();
    expect(within(summary).getByText("Total")).toBeInTheDocument();
    // Enter in the address form saved the address; it did not place the order.
    expect(getDB().intents).toHaveLength(intents);
  });

  it("shows the wallet balance and reports a voucher that does not apply", async () => {
    const user = userEvent.setup();
    await cartWithOneLine();
    if (!(await call<Address[]>("/me/addresses")).length)
      await call("/me/addresses", {
        body: { recipient: "An", phone: "0900000001", address: "1 Le Loi" },
      });
    mount("/checkout");
    const payment = await screen.findByRole(
      "region",
      { name: /Payment/ },
      LOAD,
    );
    expect(
      await within(payment).findByRole("radio", { name: /Wallet.*Balance/ }),
    ).toBeInTheDocument();
    await screen.findByRole("radio", { name: /Express/ }, LOAD);
    await user.type(screen.getByLabelText("Voucher code"), "nosuchcode");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("NOSUCHCODE can’t be applied to this order."),
    ).toBeInTheDocument();
  });
});

describe("W-17 payment (TASK-025 C6)", () => {
  it("leads with a status hero and puts amount and reference side by side with copy buttons", async () => {
    await cartWithOneLine();
    const address = await call<Address>("/me/addresses", {
      body: { recipient: "An", phone: "0900000001", address: "1 Le Loi" },
    });
    const cart = await call<{
      groups: { seller: { id: string }; items: { id: string }[] }[];
    }>("/cart");
    const result = await call<CheckoutResult>("/checkout", {
      headers: { "Idempotency-Key": "task-025-payment-hero" },
      body: {
        cartItemIds: cart.groups.flatMap((g) => g.items.map((i) => i.id)),
        addressId: address.id,
        shippingOptionIds: Object.fromEntries(
          cart.groups.map((g) => [g.seller.id, "standard"]),
        ),
        paymentMethod: "VIETQR",
      },
    });
    mount(`/pay/${result.paymentIntent.id}`);
    expect(
      await screen.findByRole("heading", { name: "Pay with VietQR" }, LOAD),
    ).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "VietQR transfer" });
    expect(
      within(card).getByRole("button", { name: "Copy amount" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Copy reference" }),
    ).toBeInTheDocument();
    expect(within(card).getByRole("timer")).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(formatMoney(result.paymentIntent.amount, "VND"))
        .length,
    ).toBeGreaterThanOrEqual(2);
  });
});
