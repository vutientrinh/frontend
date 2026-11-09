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
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../features/banking/AuthContext";
import { setSession } from "../features/banking/client";
import type { Tokens } from "../features/banking/types";
import type {
  CatalogHome,
  OrderDetail,
  PageResponse,
  ShopperOrder,
} from "../features/commerce/types";
import { CartSummary } from "../features/storefront/components/CartSummary";
import { activityOf, progressSteps } from "../features/storefront/lib";
import { storefrontRoutes } from "../features/storefront/routes";
import { bankingHandlers, resetBanking } from "../mocks/banking";
import { commerceHandlers } from "../mocks/commerce";
import { getDB, resetCommerceDB, saveDB } from "../mocks/commerce/db";
import { server } from "./setup";

/** Lazy route chunks + MSW under full-suite load (no retries). */
const LOAD = { timeout: 8000 };
// Lazy route chunks load slowly under full-suite load: wait longer (never retry).
configure({ asyncUtilTimeout: 5000 });
const url = (path: string) => new URL(`/api${path}`, window.location.origin);
let token = "";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(url(path), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as T;
}

async function signIn(phone = "0900000001") {
  token = "";
  const tokens = await api<Tokens>("/auth/login", {
    login: phone,
    password: "demo123",
  });
  token = tokens.accessToken;
  setSession(tokens);
}

function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/login", element: <h1>Sign in</h1> },
      { path: "/", element: <Outlet />, children: storefrontRoutes },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

const myOrders = (query = "") =>
  api<PageResponse<ShopperOrder>>(`/me/orders?size=100${query}`);
const cartLines = () => getDB().cart.length;

/** A delivered order waiting for confirmation (the seed may not have one: make it). */
async function deliveredOrder() {
  const found = (await myOrders("&tab=DELIVERED")).content.find((o) =>
    o.actions.includes("CONFIRM_RECEIVED"),
  );
  if (found) return found;
  const [any] = (await myOrders()).content;
  const order = getDB().orders.find((o) => o.id === any.id)!;
  const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  order.status = "DELIVERED";
  order.actions = ["CONFIRM_RECEIVED", "RETURN", "TRACK"];
  order.timeline = [
    { status: "PENDING_PAYMENT", at: at(72) },
    { status: "PAID", at: at(71) },
    { status: "CONFIRMED", at: at(60) },
    { status: "SHIPPED", at: at(48) },
    { status: "DELIVERED", at: at(2) },
  ];
  order.shipment = {
    carrier: "GHN",
    trackingNo: "GHN123",
    events: [{ status: "DELIVERED", at: at(2), location: "Ho Chi Minh City" }],
  };
  saveDB();
  return { ...any, status: order.status, actions: order.actions };
}

// Radix pointer handlers call these; jsdom does not implement them.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  resetBanking();
  resetCommerceDB();
  server.use(...commerceHandlers, ...bankingHandlers);
  await signIn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("W-19 orders list (S-09)", () => {
  it("opens on All with counts, then filters by tab in the URL", async () => {
    const user = userEvent.setup();
    const all = await myOrders();
    const delivered = await myOrders("&tab=DELIVERED");
    expect(all.totalElements).toBeGreaterThan(0);
    const router = mount("/me/orders");

    const tabs = await screen.findByRole(
      "navigation",
      { name: "Order status" },
      LOAD,
    );
    const allTab = within(tabs).getByRole("link", { name: /^All/ });
    expect(allTab).toHaveAttribute("aria-current", "page");
    await waitFor(
      () =>
        expect(allTab).toHaveAccessibleName(
          `All (${all.totalElements} ${all.totalElements === 1 ? "order" : "orders"})`,
        ),
      LOAD,
    );
    const list = await screen.findByRole("list", { name: "All orders" }, LOAD);
    expect(within(list).getAllByRole("listitem").length).toBe(
      Math.min(all.totalElements, 10),
    );

    await user.click(within(tabs).getByRole("link", { name: /^Delivered/ }));
    await waitFor(
      () => expect(router.state.location.search).toBe("?tab=DELIVERED"),
      LOAD,
    );
    const deliveredList = await screen.findByRole(
      "list",
      { name: "Delivered orders" },
      LOAD,
    );
    const first = delivered.content[0];
    const card = within(deliveredList)
      .getByText(first.orderNumber)
      .closest("li")!;
    expect(
      within(card).getByRole("link", {
        name: `View details: order ${first.orderNumber}`,
      }),
    ).toBeInTheDocument();
    if (first.actions.includes("CONFIRM_RECEIVED"))
      expect(
        within(card).getByRole("link", {
          name: `Confirm received: order ${first.orderNumber}`,
        }),
      ).toHaveAttribute("href", `/me/orders/${first.id}#confirm`);
    expect(within(card).getByRole("time")).toHaveAttribute(
      "datetime",
      first.createdAt,
    );
  });

  it("buys a finished order again from its card and offers the cart", async () => {
    const user = userEvent.setup();
    const done = (await myOrders()).content.find((o) =>
      ["COMPLETED", "CANCELLED", "REFUNDED", "RETURNED"].includes(o.status),
    );
    expect(done).toBeDefined();
    const before = cartLines();
    const router = mount(
      `/me/orders?tab=${done!.status === "CANCELLED" ? "CANCELLED" : done!.status === "COMPLETED" ? "DELIVERED" : "RETURNS"}`,
    );
    await user.click(
      await screen.findByRole(
        "button",
        { name: `Buy again: order ${done!.orderNumber}` },
        LOAD,
      ),
    );
    await user.click(
      await screen.findByRole("button", { name: "View cart" }, LOAD),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/cart"));
    expect(cartLines()).toBeGreaterThan(before);
  });
});

describe("W-20 order detail (S-10)", () => {
  it("shows progress, one activity list and explains Confirm received", async () => {
    const user = userEvent.setup();
    const delivered = await deliveredOrder();
    const detail = await api<OrderDetail>(`/me/orders/${delivered!.id}`);
    mount(`/me/orders/${delivered!.id}`);

    const progress = await screen.findByRole(
      "list",
      { name: "Order progress" },
      LOAD,
    );
    const steps = within(progress).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Placed"),
        expect.stringContaining("Completed"),
      ]),
    );
    expect(
      steps.find((s) => s.getAttribute("aria-current") === "step"),
    ).toHaveTextContent("Delivered");

    const activity = screen.getByRole("region", { name: "Activity" });
    expect(within(activity).getAllByRole("listitem")).toHaveLength(
      detail.timeline.length + (detail.shipment?.events.length ?? 0),
    );

    const confirm = screen.getByRole("button", { name: "Confirm received" });
    expect(confirm).toHaveAccessibleDescription(
      /releases your payment to the seller/,
    );
    await user.click(confirm);
    await waitFor(
      async () =>
        expect(
          (await api<OrderDetail>(`/me/orders/${delivered!.id}`)).status,
        ).toBe("COMPLETED"),
      LOAD,
    );
  });

  it("builds a cancelled branch in the progress steps", () => {
    const steps = progressSteps("CANCELLED", [
      { status: "PENDING_PAYMENT", at: "2026-11-01T08:00:00Z" },
      { status: "PAID", at: "2026-11-01T08:05:00Z" },
      { status: "CANCELLED", at: "2026-11-01T09:00:00Z" },
    ]);
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ["Placed", "done"],
      ["Paid", "done"],
      ["Cancelled", "branch"],
    ]);
    expect(steps[2].at).toBe("2026-11-01T09:00:00Z");
  });

  it("merges status changes and carrier scans newest first", () => {
    const entries = activityOf({
      timeline: [
        { status: "SHIPPED", at: "2026-11-02T08:00:00Z" },
        { status: "DELIVERED", at: "2026-11-04T08:00:00Z" },
      ],
      shipment: {
        carrier: "GHN",
        trackingNo: "T1",
        events: [
          { status: "IN_TRANSIT", at: "2026-11-03T08:00:00Z", location: "Hue" },
        ],
      },
    } as OrderDetail);
    expect(entries.map((e) => [e.title, e.kind])).toEqual([
      ["Delivered", "status"],
      ["In transit", "shipment"],
      ["Shipped", "status"],
    ]);
  });
});

describe("W-15 cart (S-08)", () => {
  it("summarises subtotal and savings and leaves shipping to checkout", () => {
    render(
      <CartSummary
        itemCount={2}
        subtotal="3580000"
        savings="450000"
        action={<button type="button">Check out (2)</button>}
      />,
    );
    const summary = screen.getByRole("region", { name: "Order summary" });
    expect(summary).toHaveTextContent("Savings");
    expect(summary).toHaveTextContent("Added at checkout");
    expect(summary).toHaveTextContent("Subtotal (2 items)");
    expect(summary).not.toHaveTextContent(/^Total/);
  });

  it("links names to the product and the seller to its shop, with a mobile check-out bar", async () => {
    const product = getDB().products.find(
      (p) => p.status === "LIVE" && p.variants.some((v) => v.stock > 1),
    )!;
    const variant = product.variants.find((v) => v.stock > 1)!;
    await api("/cart/items", { variantId: variant.id, quantity: 1 });
    mount("/cart");
    const group = await screen.findByRole(
      "region",
      { name: new RegExp(product.seller.name) },
      LOAD,
    );
    expect(
      within(group).getByRole("link", {
        name: new RegExp(product.seller.name),
      }),
    ).toHaveAttribute("href", `/shop/${product.seller.slug}`);
    expect(
      within(group).getByRole("link", { name: product.name }),
    ).toHaveAttribute("href", `/p/${product.slug}`);
    expect(
      screen.getByRole("link", { name: "Continue shopping" }),
    ).toHaveAttribute("href", "/");
    // Tests run with a narrow viewport: the sticky bottom bar holds Check out.
    expect(screen.getByRole("link", { name: "Check out (1)" })).toHaveAttribute(
      "href",
      "/checkout",
    );
    expect(screen.getByText(/item \+ shipping/)).toBeInTheDocument();
  });

  it("suggests products when the cart is empty", async () => {
    mount("/cart");
    expect(
      await screen.findByRole("heading", { name: "Your cart is empty" }, LOAD),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("list", { name: "Recommended products" }, LOAD),
    ).toBeInTheDocument();
  });
});

describe("cards, quick pick and home (S-02, S-03, S-06, S-07)", () => {
  it("opens a quick pick for multi-variant products and adds the chosen one", async () => {
    const user = userEvent.setup();
    const product = getDB().products.find(
      (p) =>
        p.status === "LIVE" &&
        p.options.length > 0 &&
        p.variants.filter((v) => v.stock > 0).length > 1,
    );
    expect(product).toBeDefined();
    const router = mount(`/search?q=${encodeURIComponent(product!.name)}`);
    const card = (
      await screen.findByRole("link", { name: product!.name }, LOAD)
    ).closest("article")!;
    await user.click(
      within(card).getByRole("button", {
        name: new RegExp(`(Add|Choose options for) ${product!.name}`),
      }),
    );
    const dialog = await screen.findByRole(
      "dialog",
      { name: product!.name },
      LOAD,
    );
    // Submitting without a choice explains what is missing.
    await user.click(
      within(dialog).getByRole("button", { name: "Add to cart" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Choose a/);
    const target = product!.variants.find((v) => v.stock > 0)!;
    for (const option of product!.options)
      await user.click(
        within(dialog).getByRole("radio", {
          name: target.options[option.name],
        }),
      );
    await user.click(
      within(dialog).getByRole("button", { name: "Add to cart" }),
    );
    await waitFor(() =>
      expect(getDB().cart.some((i) => i.variantId === target.id)).toBe(true),
    );
    await user.click(
      await screen.findByRole("button", { name: "View cart" }, LOAD),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/cart"));
  });

  it("does not repeat deals in Recommended and features an in-stock deal", async () => {
    const home = await api<CatalogHome>("/catalog/home");
    mount("/");
    const recommended = await screen.findByRole(
      "list",
      { name: "Recommended products" },
      LOAD,
    );
    for (const deal of home.deals)
      expect(
        within(recommended).queryByRole("link", { name: deal.name }),
      ).not.toBeInTheDocument();
    const deals = screen.getByRole("list", { name: "Deals" });
    expect(within(deals).getAllByRole("listitem")).toHaveLength(
      home.deals.length,
    );
    const inStockDeals = home.deals.filter((d) => d.inStock);
    if (home.banners.length === 0 && inStockDeals.length) {
      const hero = screen
        .getByText(/Today’s top deal from/)
        .closest("section")!;
      const featured = within(hero).getByRole("heading", { level: 2 });
      expect(inStockDeals.map((d) => d.name)).toContain(featured.textContent);
    }
  });
});

describe("W-13 product detail (S-05)", () => {
  it("shows the shipping estimate, specs, reviews with breakdown and more from the shop", async () => {
    const user = userEvent.setup();
    const product = getDB().products.find(
      (p) =>
        p.status === "LIVE" &&
        p.specs?.length &&
        (p.reviews?.length ?? 0) > 0 &&
        p.ratingBreakdown &&
        p.shippingEstimate,
    );
    expect(product).toBeDefined();
    const p = product!;
    mount(`/p/${p.slug}`);
    await screen.findByRole("heading", { level: 1, name: p.name }, LOAD);

    expect(screen.getByText(/Delivery to/).closest("p")).toHaveTextContent(
      `Delivery to ${p.shippingEstimate!.destination} in`,
    );

    const specs = screen.getByRole("region", { name: "Specifications" });
    for (const spec of p.specs!)
      expect(within(specs).getByText(spec.label)).toBeInTheDocument();

    const reviews = screen.getByRole("region", { name: "Reviews" });
    const breakdown = within(reviews).getByRole("list", {
      name: "Rating breakdown",
    });
    expect(within(breakdown).getAllByRole("listitem")).toHaveLength(5);
    expect(breakdown).toHaveTextContent(
      `${p.ratingBreakdown![5]} ${p.ratingBreakdown![5] === 1 ? "rating" : "ratings"}`,
    );
    const newest = [...p.reviews!].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
    expect(within(reviews).getByText(newest.title)).toBeInTheDocument();
    if (p.reviews!.length > 4) {
      await user.click(
        within(reviews).getByRole("button", { name: /Show all/ }),
      );
      expect(
        within(reviews).getByRole("button", { name: "Show fewer reviews" }),
      ).toHaveAttribute("aria-expanded", "true");
    }

    const siblings = getDB().products.filter(
      (o) =>
        o.seller.id === p.seller.id && o.status === "LIVE" && o.id !== p.id,
    );
    if (siblings.length) {
      const more = await screen.findByRole(
        "list",
        { name: `More from ${p.seller.name}` },
        LOAD,
      );
      expect(
        within(more).queryByRole("link", { name: p.name }),
      ).not.toBeInTheDocument();
      expect(within(more).getAllByRole("listitem").length).toBeGreaterThan(0);
    }
  });

  it("explains when a product has no reviews yet", async () => {
    const product = getDB().products.find((p) => p.status === "LIVE")!;
    product.reviews = [];
    product.ratingCount = 0;
    delete product.ratingBreakdown;
    saveDB();
    mount(`/p/${product.slug}`);
    const reviews = await screen.findByRole(
      "region",
      { name: "Reviews" },
      LOAD,
    );
    expect(reviews).toHaveTextContent("No reviews yet");
  });
});
