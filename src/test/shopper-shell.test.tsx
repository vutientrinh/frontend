import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopperShell from "../features/banking/ShopperShell";

const { requestMock, authState } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  authState: {
    user: {
      id: "shopper-1",
      fullName: "Minh An",
      phone: "0900000001",
      roles: ["SHOPPER"],
    },
    signOut: vi.fn(),
  },
}));

vi.mock("../features/banking/client", () => ({ request: requestMock }));
vi.mock("../features/banking/AuthContext", () => ({
  useAuth: () => authState,
}));

const cart = (quantity: number) => ({
  groups: quantity
    ? [
        {
          items: Array.from({ length: quantity }, (_, index) => ({
            id: `line-${index + 1}`,
            quantity: 1,
          })),
        },
      ]
    : [],
});

const BUMP = "motion-safe:scale-110";

/**
 * The bump lasts 120 ms, so polling for the class misses it on a busy machine. Record every class
 * change instead: `seen()` is true if the badge has the class now or had it since watching began.
 */
function watchBump(badge: Element) {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((batch) => records.push(...batch));
  observer.observe(badge, {
    attributeFilter: ["class"],
    attributeOldValue: true,
  });
  return {
    seen: () => {
      records.push(...observer.takeRecords());
      return (
        badge.classList.contains(BUMP) ||
        records.some((record) => record.oldValue?.split(" ").includes(BUMP))
      );
    },
    stop: () => observer.disconnect(),
  };
}

function renderShopperShell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <button
          type="button"
          onClick={() =>
            void client.invalidateQueries({ queryKey: ["commerce", "cart"] })
          }
        >
          Refresh cart
        </button>
        <ShopperShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ShopperShell cart badge", () => {
  beforeEach(() => {
    requestMock.mockReset();
    authState.user = {
      id: "shopper-1",
      fullName: "Minh An",
      phone: "0900000001",
      roles: ["SHOPPER"],
    };
    localStorage.removeItem("payment-balance-visible");
  });

  it("updates the count and bumps only when the count increases", async () => {
    const cartResponses = [cart(2), cart(3), cart(2)];
    requestMock.mockImplementation((path: string) => {
      if (path === "/catalog/categories") return Promise.resolve([]);
      if (path === "/wallets/me")
        return Promise.resolve({ availableBalance: "0" });
      if (path === "/cart")
        return Promise.resolve(cartResponses.shift() ?? cart(2));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const user = userEvent.setup();
    renderShopperShell();

    const headerCart = (name: string) =>
      within(screen.getByRole("banner")).findByRole("link", { name });
    const initialCart = await headerCart("Cart, 2 items");
    const initialBadge = initialCart.querySelector("span[aria-hidden='true']");
    expect(initialBadge).not.toBeNull();
    expect(initialBadge).not.toHaveClass(BUMP);

    const onIncrease = watchBump(initialBadge!);
    await user.click(screen.getByRole("button", { name: "Refresh cart" }));
    await headerCart("Cart, 3 items");
    await waitFor(() => expect(onIncrease.seen()).toBe(true));
    onIncrease.stop();
    // Let the bump finish, so its removal cannot be mistaken for a bump on the way down.
    await waitFor(() => expect(initialBadge).not.toHaveClass(BUMP));

    const onDecrease = watchBump(initialBadge!);
    await user.click(screen.getByRole("button", { name: "Refresh cart" }));
    const decreasedCart = await headerCart("Cart, 2 items");
    expect(decreasedCart.querySelector("span[aria-hidden='true']")).toBe(
      initialBadge,
    );
    expect(onDecrease.seen()).toBe(false);
    onDecrease.stop();
  });

  it("shows the inline theme radios in the shopper account disclosure", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path === "/wallets/me")
        return Promise.resolve({ availableBalance: "100000" });
      if (path === "/cart") return Promise.resolve(cart(0));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const user = userEvent.setup();
    renderShopperShell();
    await user.click(
      screen.getByRole("button", { name: "Account menu, Minh An" }),
    );
    expect(
      screen.getByRole("radiogroup", { name: "Theme" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(localStorage.getItem("payment-theme")).toBe("dark");
  });

  it("offers guest sign-in and register actions", () => {
    (authState as { user: unknown }).user = null;
    requestMock.mockImplementation((path: string) => {
      if (path === "/catalog/categories") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderShopperShell();
    expect(
      screen.getAllByRole("link", { name: /Sign in/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Register/ }).length,
    ).toBeGreaterThan(0);
  });

  it("shows the unread count on the bell and marks all read from the popover", async () => {
    let unread = 3;
    requestMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/wallets/me")
        return Promise.resolve({ availableBalance: "100000" });
      if (path === "/cart") return Promise.resolve(cart(0));
      if (path === "/me/notifications/unread-count")
        return Promise.resolve({ count: unread });
      if (path === "/me/notifications/read") {
        unread = 0;
        expect(init?.method).toBe("POST");
        return Promise.resolve(undefined);
      }
      if (path.startsWith("/me/notifications"))
        return Promise.resolve({
          content: [
            {
              id: "n1",
              kind: "ORDER",
              title: "Order shipped",
              body: "Order 2611-0042",
              href: "/me/orders/1",
              createdAt: new Date().toISOString(),
              readAt: null,
            },
          ],
          page: 0,
          size: 5,
          totalElements: 1,
          totalPages: 1,
        });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const user = userEvent.setup();
    renderShopperShell();
    const header = within(screen.getByRole("banner"));
    const bell = await header.findByRole("button", {
      name: "Notifications, 3 unread",
    });
    await user.click(bell);
    expect(await screen.findByText("Order shipped")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(
      await header.findByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Order shipped")).not.toBeInTheDocument();
  });
});
