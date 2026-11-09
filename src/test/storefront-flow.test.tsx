import Big from "big.js";
import {
  configure,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../features/banking/AuthContext";
import { setSession } from "../features/banking/client";
import type { Tokens } from "../features/banking/types";
import { storefrontRoutes } from "../features/storefront/routes";
import {
  bankingHandlers,
  bankingTrialBalance,
  resetBanking,
  setBankingTierForTest,
} from "../mocks/banking";
import { commerceHandlers } from "../mocks/commerce";
import { getDB, resetCommerceDB, saveDB } from "../mocks/commerce/db";
import { paymentPort } from "../mocks/commerce/paymentPort";
import { server } from "./setup";

// Lazy route chunks load slowly under full-suite load: wait longer (never retry).
configure({ asyncUtilTimeout: 5000 });
const url = (path: string) => new URL(`/api${path}`, window.location.origin);
let token = "";
/** Lazy route chunks + MSW under full-suite load can take a few seconds (no retries). */
const LOAD = { timeout: 8000 };

async function api(path: string, body?: unknown, idempotencyKey?: string) {
  const response = await fetch(url(path), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function signIn(phone = "0900000001") {
  token = "";
  const tokens = (await api("/auth/login", {
    login: phone,
    password: "demo123",
  })) as Tokens;
  token = tokens.accessToken;
  setSession(tokens);
}

/**
 * Wallet checkout charges the real balance and enforces KYC limits. The two-seller order is
 * above the seeded balance and the tier-1 per-transaction limit, so raise the shopper to
 * tier 2 and top up through the real VietQR → bank simulator flow.
 */
async function fundWallet(value: string) {
  const me = (await api("/me")) as { id: string };
  setBankingTierForTest(me.id, 2);
  const top = (await api(
    "/wallets/me/top-ups",
    { amount: value, method: "VIETQR" },
    `fund-${value}`,
  )) as { reference: string };
  const [account] = (await api("/bank-sim/accounts")) as { id: string }[];
  await fetch(url("/bank-sim/failure-config"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      delayMs: 0,
      declineRate: 0,
      duplicateCallback: false,
    }),
  });
  await api(
    "/bank-sim/transfers",
    { fromAccountId: account.id, toReference: top.reference, amount: value },
    `fund-transfer-${value}`,
  );
  const wallet = (await api("/wallets/me")) as { availableBalance: string };
  expect(new Big(wallet.availableBalance).gte(value)).toBe(true);
}

const addAddress = () =>
  api("/me/addresses", {
    recipient: "Nguyen Van An",
    phone: "0900000001",
    address: "12 Le Loi, District 1, Ho Chi Minh City",
  });

/** In-stock live products, cheapest first, one per seller. */
function productsFromDifferentSellers(count: number) {
  const seen = new Set<string>();
  return getDB()
    .products.filter(
      (p) => p.status === "LIVE" && p.variants.some((v) => v.stock > 1),
    )
    .sort((a, b) => Number(a.price) - Number(b.price))
    .filter((p) => !seen.has(p.seller.id) && !!seen.add(p.seller.id))
    .slice(0, count);
}
const firstInStock = (slug: string) =>
  getDB()
    .products.find((p) => p.slug === slug)!
    .variants.find((v) => v.stock > 1)!;

function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/login", element: <h1>Sign in</h1> },
      { path: "/wallet/top-up", element: <h1>Top up</h1> },
      { path: "/", element: <Outlet />, children: storefrontRoutes },
    ],
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

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  resetBanking();
  resetCommerceDB();
  server.use(...commerceHandlers, ...bankingHandlers);
  vi.spyOn(paymentPort, "available").mockResolvedValue("50000000");
  await signIn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("storefront flow", () => {
  it("browses, adds from two sellers, checks out and pays with wallet", async () => {
    await fundWallet("3000000");
    const user = userEvent.setup();
    const [a, b] = productsFromDifferentSellers(2);
    const router = mount(`/p/${a.slug}`);
    await user.click(
      await screen.findByRole("button", { name: "Add to cart" }, LOAD),
    );
    await waitFor(() =>
      expect(getDB().cart.some((i) => i.productSlug === a.slug)).toBe(true),
    );
    await router.navigate(`/p/${b.slug}`);
    await screen.findByRole("heading", { level: 1, name: b.name });
    await user.click(screen.getByRole("button", { name: "Buy now" }));

    expect(
      await screen.findByRole("heading", { name: "Cart" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: a.seller.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: b.seller.name }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Check out (2)" }));

    // No saved address yet: items and their subtotal show at once, the address form is open,
    // and Place order says why it is disabled (TASK-025 C1).
    const form = await screen.findByRole("group", { name: "New address" });
    const summary = screen.getByRole("region", { name: "Order summary" });
    expect(
      within(summary).getByText("Total before shipping"),
    ).toBeInTheDocument();
    expect(within(summary).queryByText("₫0")).not.toBeInTheDocument();
    expect(
      within(summary).getByText("Add an address first"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Place order" }),
    ).toHaveAccessibleDescription(
      "Add a delivery address to place your order.",
    );
    await user.type(within(form).getByLabelText("Recipient"), "Nguyen Van An");
    await user.type(within(form).getByLabelText("Phone"), "0900000001");
    await user.type(within(form).getByLabelText("Address"), "12 Le Loi, HCMC");
    await user.click(
      within(form).getByRole("button", { name: "Save and use this address" }),
    );
    expect(
      await screen.findByRole("radio", { name: /12 Le Loi, HCMC/ }),
    ).toBeChecked();

    // Shipping per seller from the quote; choose express for the first seller.
    const sellerBlock = await screen.findByRole(
      "region",
      { name: a.seller.name },
      LOAD,
    );
    await user.click(
      within(sellerBlock).getByRole("radio", { name: /Express/ }),
    );
    await user.click(screen.getByRole("button", { name: "Place order" }));

    const otp = await screen
      .findByLabelText("One-time code", {}, { timeout: 3000 })
      .catch(() => null);
    if (otp) {
      await user.type(otp, "123456");
      await user.click(screen.getByRole("button", { name: "Confirm payment" }));
    }
    expect(
      await screen.findByRole(
        "heading",
        { name: "Order placed and paid" },
        LOAD,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Track" })).toHaveLength(2);
    const parent = getDB().orders.at(-1)!.parentOrderId;
    const placed = getDB().orders.filter((o) => o.parentOrderId === parent);
    expect(placed.map((o) => o.status)).toEqual(["PAID", "PAID"]);
  });

  it("offers a top-up when the wallet is short and allows VietQR instead", async () => {
    vi.spyOn(paymentPort, "available").mockResolvedValue("100000");
    const user = userEvent.setup();
    const [a] = productsFromDifferentSellers(1);
    await addAddress();
    await api("/cart/items", {
      variantId: firstInStock(a.slug).id,
      quantity: 1,
    });
    mount("/checkout");
    const alert = await screen.findByRole("alert", {}, LOAD);
    expect(alert).toHaveTextContent("Your wallet is short by");
    expect(within(alert).getByRole("link", { name: /Top up/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/wallet\/top-up\?amount=\d+$/),
    );
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /VietQR/ }));
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
  });

  it("pays with VietQR through the dev simulator", async () => {
    const user = userEvent.setup();
    const [a] = productsFromDifferentSellers(1);
    await addAddress();
    await api("/cart/items", {
      variantId: firstInStock(a.slug).id,
      quantity: 1,
    });
    mount("/checkout");
    await user.click(await screen.findByRole("radio", { name: /VietQR/ }));
    const place = screen.getByRole("button", { name: "Place order" });
    await waitFor(() => expect(place).toBeEnabled(), LOAD);
    await user.click(place);
    expect(
      await screen.findByRole("heading", { name: "Pay with VietQR" }, LOAD),
    ).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/1[45]:\d\d/);
    await user.click(screen.getByRole("button", { name: "Simulate success" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Order placed and paid" },
        LOAD,
      ),
    ).toBeInTheDocument();
  });

  it("settles a VietQR payment intent through the bank-sim callback into escrow", async () => {
    const [product] = productsFromDifferentSellers(1);
    const address = (await addAddress()) as { id: string };
    await api("/cart/items", {
      variantId: firstInStock(product.slug).id,
      quantity: 1,
    });
    const cart = (await api("/cart")) as {
      groups: { items: { id: string }[] }[];
    };
    const cartItemIds = cart.groups.flatMap((group) =>
      group.items.map((item) => item.id),
    );
    const quote = (await api("/checkout/quote", {
      cartItemIds,
      addressId: address.id,
    })) as {
      groups: { seller: { id: string }; selectedShippingOptionId: string }[];
    };
    const shippingOptionIds = Object.fromEntries(
      quote.groups.map((group) => [
        group.seller.id,
        group.selectedShippingOptionId,
      ]),
    );
    const checkoutResponse = await fetch(url("/checkout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": "bank-sim-commerce-checkout",
      },
      body: JSON.stringify({
        cartItemIds,
        addressId: address.id,
        shippingOptionIds,
        paymentMethod: "VIETQR",
      }),
    });
    expect(checkoutResponse.status).toBe(200);
    const checkout = (await checkoutResponse.json()) as {
      paymentIntent: { id: string; reference: string; amount: string };
      parentOrderId: string;
    };
    const banking = JSON.parse(
      localStorage.getItem("payment-banking-mock-v3")!,
    ) as {
      users: { id: string; phone: string }[];
      journals: {
        reference: string;
        lines: { account: string; debit: string; credit: string }[];
      }[];
    };
    const owner = banking.users.find((user) => user.phone === "0900000001")!;
    const transfer = await fetch(url("/bank-sim/transfers"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "bank-sim-commerce-transfer",
      },
      body: JSON.stringify({
        fromAccountId: owner.id,
        toReference: checkout.paymentIntent.reference,
        amount: checkout.paymentIntent.amount,
      }),
    });
    expect(transfer.status).toBe(200);
    expect(
      getDB().intents.find((intent) => intent.id === checkout.paymentIntent.id)
        ?.status,
    ).toBe("SUCCEEDED");
    expect(
      getDB()
        .orders.filter(
          (order) => order.parentOrderId === checkout.parentOrderId,
        )
        .every((order) => order.status === "PAID"),
    ).toBe(true);
    const saved = JSON.parse(
      localStorage.getItem("payment-banking-mock-v3")!,
    ) as typeof banking;
    const journal = saved.journals.find(
      (entry) =>
        entry.reference === `COMMERCE-VIETQR:${checkout.paymentIntent.id}`,
    )!;
    expect(journal.lines).toEqual([
      { account: "1010", debit: checkout.paymentIntent.amount, credit: "0" },
      { account: "2030", debit: "0", credit: checkout.paymentIntent.amount },
    ]);
    expect(bankingTrialBalance()).toBe("0");
  });
  it("shows expiry and a retry with the other method", async () => {
    const user = userEvent.setup();
    const [a] = productsFromDifferentSellers(1);
    const address = (await addAddress()) as { id: string };
    await api("/cart/items", {
      variantId: firstInStock(a.slug).id,
      quantity: 1,
    });
    const cart = (await api("/cart")) as {
      groups: { seller: { id: string }; items: { id: string }[] }[];
    };
    const response = await fetch(url("/checkout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": "expiry-test",
      },
      body: JSON.stringify({
        cartItemIds: cart.groups.flatMap((g) => g.items.map((i) => i.id)),
        addressId: address.id,
        shippingOptionIds: Object.fromEntries(
          cart.groups.map((g) => [g.seller.id, "standard"]),
        ),
        paymentMethod: "VIETQR",
      }),
    });
    const result = (await response.json()) as { paymentIntent: { id: string } };
    const intent = getDB().intents.find(
      (i) => i.id === result.paymentIntent.id,
    )!;
    intent.expiresAt = new Date(Date.now() - 1000).toISOString();
    saveDB();

    const router = mount(`/pay/${intent.id}`);
    expect(
      await screen.findByText("The payment window expired.", {}, LOAD),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Try again with wallet" }),
    );
    expect(router.state.location.pathname).toBe("/checkout");
  });

  it("keeps cart quantities between 1 and stock", async () => {
    const user = userEvent.setup();
    const [a] = productsFromDifferentSellers(1);
    const variant = firstInStock(a.slug);
    await api("/cart/items", { variantId: variant.id, quantity: 1 });
    mount("/cart");
    const input = await screen.findByLabelText(`Quantity of ${a.name}`, {
      selector: "input",
    });
    expect(
      screen.getByRole("button", { name: `Decrease quantity of ${a.name}` }),
    ).toBeDisabled();
    await user.clear(input);
    await user.type(input, "999");
    await user.tab();
    await waitFor(() => expect(input).toHaveValue(String(variant.stock)));
    expect(getDB().cart[0].quantity).toBe(variant.stock);
    expect(
      screen.getByRole("button", { name: `Increase quantity of ${a.name}` }),
    ).toBeDisabled();
  });

  it("sends guests to sign in when they add to cart", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();
    const [a] = productsFromDifferentSellers(1);
    const router = mount(`/p/${a.slug}`);
    await user.click(
      await screen.findByRole("button", { name: "Add to cart" }, LOAD),
    );
    expect(router.state.location.pathname).toBe("/login");
  });
});

describe("search URL state", () => {
  it("keeps sort, category, rating and page in the URL and clears them", async () => {
    const user = userEvent.setup();
    const router = mount("/search?q=item");
    expect(
      await screen.findByRole("heading", { name: "Results for “item”" }),
    ).toBeInTheDocument();
    await screen.findByRole("list", { name: "Products" }, LOAD);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort by" }),
      "price_asc",
    );
    expect(router.state.location.search).toContain("sort=price_asc");

    const filters = screen.getByRole("complementary", { name: "Filters" });
    await user.click(
      await within(filters).findByRole("radio", { name: "Electronics" }),
    );
    let params = new URLSearchParams(router.state.location.search);
    expect(params.get("category")).toBe("electronics");
    expect(params.get("q")).toBe("item");
    expect(params.get("sort")).toBe("price_asc");

    await user.click(
      within(filters).getByRole("radio", { name: "4 stars & up" }),
    );
    params = new URLSearchParams(router.state.location.search);
    expect(params.get("minRating")).toBe("4");

    // Back button restores the previous filters.
    await router.navigate(-1);
    await waitFor(() =>
      expect(
        new URLSearchParams(router.state.location.search).get("minRating"),
      ).toBeNull(),
    );

    await user.click(
      within(filters).getByRole("button", { name: "Clear filters" }),
    );
    expect(router.state.location.search).toBe("?q=item");
  });

  it("category page is search pre-filtered by the path", async () => {
    const router = mount("/c/electronics");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Electronics" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("navigation", { name: "Sub-categories" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/c/electronics");
  });
});
