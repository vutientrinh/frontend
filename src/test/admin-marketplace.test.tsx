import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../features/banking/client";
import type { Tokens } from "../features/banking/types";
import {
  adminMarketplaceNav,
  adminMarketplaceRoutes,
} from "../features/admin-marketplace/routes";
import type {
  AdminCategory,
  AdminOrderDetail,
  AdminSellerOrderRow,
  AdminSellerRow,
  ModerationProduct,
  PageResponse,
} from "../features/admin-marketplace/types";
import { rateError } from "../features/admin-marketplace/lib";
import {
  adminMarketplaceHandlers,
  resetAdminMarketplace,
} from "../mocks/admin-marketplace";
import { bankingHandlers, resetBanking } from "../mocks/banking";
import { commerceHandlers } from "../mocks/commerce";
import { getDB, resetCommerceDB, saveDB } from "../mocks/commerce/db";
import { server } from "./setup";

const url = (path: string) => new URL(`/api${path}`, window.location.origin);
let token = "";

async function call(path: string, body?: unknown, method?: string) {
  return fetch(url(path), {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function api<T>(path: string, body?: unknown, method?: string) {
  const response = await call(path, body, method);
  expect(response.status).toBeLessThan(300);
  return (await response.json()) as T;
}

async function signIn(login: string) {
  token = "";
  const tokens = await api<Tokens>("/auth/login", {
    login,
    password: "demo123",
  });
  token = tokens.accessToken;
  setSession(tokens);
}

function setWide(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    () =>
      ({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/admin", element: <Outlet />, children: adminMarketplaceRoutes }],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const ordersPage = () =>
  api<PageResponse<AdminSellerOrderRow>>("/admin/marketplace-orders?size=100");

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  resetBanking();
  resetCommerceDB();
  resetAdminMarketplace();
  server.use(
    ...adminMarketplaceHandlers,
    ...commerceHandlers,
    ...bankingHandlers,
  );
  setWide(false);
  await signIn("admin");
});
afterEach(() => {
  setWide(false);
});

describe("admin marketplace routes", () => {
  it("exports relative lazy routes and nav entries that match them", () => {
    const paths = adminMarketplaceRoutes.map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "marketplace/customers",
        "marketplace/customers/:id",
        "marketplace/sellers",
        "marketplace/sellers/:id",
        "marketplace/categories",
        "marketplace/moderation",
        "marketplace/orders",
        "marketplace/orders/:id",
      ]),
    );
    for (const r of adminMarketplaceRoutes) {
      expect(r.path?.startsWith("/")).toBe(false);
      expect(r.lazy).toBeTypeOf("function");
    }
    for (const item of adminMarketplaceNav)
      expect(paths).toContain(item.to.replace("/admin/", ""));
  });
});

describe("admin marketplace mock contract", () => {
  it("requires a staff session", async () => {
    token = "";
    expect((await call("/admin/sellers")).status).toBe(401);
    await signIn("0900000001");
    expect((await call("/admin/sellers")).status).toBe(401);
  });

  it("validates commission 0–30 with one decimal and lets finance change it", async () => {
    const sellers = await api<PageResponse<AdminSellerRow>>("/admin/sellers");
    const seller = sellers.content[0];
    const put = (ratePercent: string) =>
      call(`/admin/sellers/${seller.id}/commission`, { ratePercent }, "PUT");
    expect((await put("30.1")).status).toBe(400);
    expect((await put("5.55")).status).toBe(400);
    await signIn("finance");
    expect((await put("7.5")).status).toBe(200);
    const detail = await api<AdminSellerRow>(`/admin/sellers/${seller.id}`);
    expect(detail.commissionRatePercent).toBe("7.5");
  });

  it("returns the order detail with saga trace, money and full staff names", async () => {
    const [row] = (await ordersPage()).content;
    const detail = await api<AdminOrderDetail & { buyer?: unknown }>(
      `/admin/marketplace-orders/${row.id}`,
    );
    expect(detail.sagaEvents.length).toBeGreaterThan(0);
    expect(new Set(detail.sagaEvents.map((e) => e.correlationId)).size).toBe(1);
    expect(detail.money.gross).toMatch(/^\d+$/);
    expect(detail.buyer).toBeUndefined();
    expect(detail.customer.name).not.toContain("*");
  });

  it("refuses a cancel without a reason", async () => {
    const rows = (await ordersPage()).content;
    const open = rows.find((r) =>
      ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PACKED"].includes(r.status),
    )!;
    const response = await call(`/admin/marketplace-orders/${open.id}/cancel`, {
      reason: " ",
    });
    expect(response.status).toBe(400);
  });
});

describe("commission rule", () => {
  it.each([
    ["0", undefined],
    ["30", undefined],
    ["12.5", undefined],
    ["30.5", "Commission cannot be higher than 30%."],
    ["5.55", expect.stringContaining("one decimal")],
    ["-1", expect.stringContaining("one decimal")],
  ])("rateError(%s)", (value, expected) => {
    expect(rateError(value)).toEqual(expected);
  });
});

/** Generous wait for the lazy route chunk + MSW data under full-suite load (no retries). */
const LOAD = { timeout: 8000 };

/** Waits for the lazy A-14 page and its first page of rows; returns rows in DOM order. */
async function loadedOrderRows() {
  await screen.findByRole(
    "heading",
    { level: 1, name: "Marketplace orders" },
    LOAD,
  );
  const byNumber = new Map(
    (await ordersPage()).content.map((r) => [r.orderNumber, r]),
  );
  let rows: AdminSellerOrderRow[] = [];
  await waitFor(() => {
    // Each cell starts with a mobile-only column label, so match on the end of the text.
    rows = screen
      .getAllByRole("row")
      .map((tr) => within(tr).queryAllByRole("cell")[0]?.textContent ?? "")
      .map((text) => [...byNumber.keys()].find((n) => text.endsWith(n)))
      .filter((n): n is string => !!n)
      .map((n) => byNumber.get(n)!);
    expect(rows.length).toBeGreaterThan(1);
  }, LOAD);
  return rows;
}

const panel = () =>
  screen.queryByRole("complementary", { name: "Selected order" });

describe("A-14 marketplace orders split view", () => {
  it("moves with J/K, opens with Enter and closes with Esc", async () => {
    setWide(true);
    const user = userEvent.setup();
    const router = mount("/admin/marketplace/orders");
    const rows = await loadedOrderRows();
    const selectedIs = (row: AdminSellerOrderRow) =>
      waitFor(() => {
        expect(router.state.location.search).toContain(`selected=${row.id}`);
        expect(panel()).toHaveTextContent(row.orderNumber);
      }, LOAD);

    await user.keyboard("j");
    await selectedIs(rows[0]);
    await user.keyboard("j");
    await selectedIs(rows[1]);
    await user.keyboard("k");
    await selectedIs(rows[0]);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(router.state.location.search).not.toContain("selected=");
      expect(panel()).not.toBeInTheDocument();
    }, LOAD);

    await user.keyboard("j");
    await selectedIs(rows[0]);
    await user.keyboard("{Enter}");
    await waitFor(
      () =>
        expect(router.state.location.pathname).toBe(
          `/admin/marketplace/orders/${rows[0].id}`,
        ),
      LOAD,
    );
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: `Order ${rows[0].orderNumber}` },
        LOAD,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the status filter in the URL and shows status labels", async () => {
    const user = userEvent.setup();
    const router = mount("/admin/marketplace/orders");
    await loadedOrderRows();
    await user.click(screen.getByRole("button", { name: "Pending payment" }));
    await waitFor(() => {
      expect(router.state.location.search).toContain("status=PENDING_PAYMENT");
      expect(
        screen.getByRole("button", { name: "Pending payment" }),
      ).toHaveAttribute("aria-pressed", "true");
    }, LOAD);
    // The filtered list shows only pending rows, each with its human status label.
    const pending = (
      await api<PageResponse<AdminSellerOrderRow>>(
        "/admin/marketplace-orders?status=PENDING_PAYMENT&size=100",
      )
    ).content;
    expect(pending.length).toBeGreaterThan(0);
    await waitFor(() => {
      const bodyRows = screen
        .getAllByRole("row")
        .filter((tr) => within(tr).queryAllByRole("cell").length);
      expect(bodyRows).toHaveLength(Math.min(pending.length, 20));
      for (const tr of bodyRows)
        expect(within(tr).getByText("Pending payment")).toBeInTheDocument();
    }, LOAD);
  });
});

describe("A-15 order detail", () => {
  it("shows the saga trace by service and cancels with a reason", async () => {
    const user = userEvent.setup();
    const order = (await ordersPage()).content.find(
      (r) => r.status === "PAID" || r.status === "CONFIRMED",
    )!;
    mount(`/admin/marketplace/orders/${order.id}`);
    await screen.findByRole("heading", {
      level: 1,
      name: `Order ${order.orderNumber}`,
    });
    const saga = screen.getByRole("region", { name: "Saga trace" });
    expect(within(saga).getByText("Correlation id")).toBeInTheDocument();
    expect(
      within(saga).getByRole("region", { name: /Commerce/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Payment intent" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Shipment" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("dialog", {
      name: `Cancel order ${order.orderNumber}?`,
    });
    expect(dialog).toHaveTextContent(/refunded/);
    await user.click(
      within(dialog).getByRole("button", { name: "Cancel and refund" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Enter a reason",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Customer request" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Cancel and refund" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const after = await api<AdminOrderDetail>(
      `/admin/marketplace-orders/${order.id}`,
    );
    expect(after.status).toBe("CANCELLED");
  });
});

describe("A-11 seller detail", () => {
  it("validates and confirms a commission change", async () => {
    const user = userEvent.setup();
    const seller = (
      await api<PageResponse<AdminSellerRow>>("/admin/sellers")
    ).content.find((s) => s.status === "APPROVED")!;
    mount(`/admin/marketplace/sellers/${seller.id}`);
    const input = await screen.findByLabelText("Commission rate (%)");
    await user.clear(input);
    await user.type(input, "45");
    await user.click(screen.getByRole("button", { name: "Update commission" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "higher than 30%",
    );
    await user.clear(input);
    await user.type(input, "8.5");
    await user.click(screen.getByRole("button", { name: "Update commission" }));
    const dialog = await screen.findByRole("dialog", {
      name: `Change commission for ${seller.name}?`,
    });
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(async () =>
      expect(
        (await api<AdminSellerRow>(`/admin/sellers/${seller.id}`))
          .commissionRatePercent,
      ).toBe("8.5"),
    );
  });

  it("suspends an approved seller with a reason", async () => {
    const user = userEvent.setup();
    const seller = (
      await api<PageResponse<AdminSellerRow>>("/admin/sellers")
    ).content.find((s) => s.status === "APPROVED")!;
    mount(`/admin/marketplace/sellers/${seller.id}`);
    await user.click(
      await screen.findByRole("button", { name: "Suspend shop" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: `Suspend ${seller.name}?`,
    });
    await user.type(within(dialog).getByLabelText("Reason"), "Late shipping");
    await user.click(
      within(dialog).getByRole("button", { name: "Suspend seller" }),
    );
    expect(
      await screen.findByRole("button", { name: "Reinstate shop" }),
    ).toBeInTheDocument();
  });
});

describe("A-12 categories", () => {
  it("adds a child category with its commission", async () => {
    const user = userEvent.setup();
    const [root] = await api<AdminCategory[]>("/admin/catalog/categories");
    mount("/admin/marketplace/categories");
    await user.click(
      await screen.findByRole("button", {
        name: `Add sub-category to ${root.name}`,
      }),
    );
    const form = screen.getByRole("form", {
      name: `New sub-category of ${root.name}`,
    });
    await user.type(within(form).getByLabelText("Name"), "Test gadgets");
    const rate = within(form).getByLabelText("Commission (%)");
    await user.clear(rate);
    await user.type(rate, "6.5");
    await user.click(
      within(form).getByRole("button", { name: "Add category" }),
    );
    expect(
      await within(
        await screen.findByRole("list", {
          name: `${root.name} sub-categories`,
        }),
      ).findByText("Test gadgets"),
    ).toBeInTheDocument();
  });
});

describe("A-13 moderation", () => {
  it("rejects a pending listing with a reason", async () => {
    // The seed has no listing waiting for review: send one back to the queue.
    getDB().products.find((p) => p.status === "LIVE")!.status =
      "PENDING_REVIEW";
    saveDB();
    const queue = await api<PageResponse<ModerationProduct>>(
      "/admin/catalog/moderation",
    );
    expect(queue.content.length).toBeGreaterThan(0);
    const product = queue.content[0];
    const user = userEvent.setup();
    mount("/admin/marketplace/moderation");
    const preview = await screen.findByRole("article", {
      name: `Preview: ${product.name}`,
    });
    await user.click(within(preview).getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", {
      name: `Reject ${product.name}?`,
    });
    await user.type(within(dialog).getByLabelText("Reason"), "Blurry photos");
    await user.click(
      within(dialog).getByRole("button", { name: "Reject listing" }),
    );
    await waitFor(async () => {
      const rejected = await api<PageResponse<ModerationProduct>>(
        "/admin/catalog/moderation?status=REJECTED",
      );
      expect(rejected.content.map((p) => p.id)).toContain(product.id);
    });
  });
});
