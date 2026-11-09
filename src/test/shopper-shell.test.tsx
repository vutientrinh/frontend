import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopperShell from "../features/banking/ShopperShell";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("../features/banking/client", () => ({ request: requestMock }));
vi.mock("../features/banking/AuthContext", () => ({
  useAuth: () => ({
    user: { roles: ["SHOPPER"] },
    signOut: vi.fn(),
  }),
}));

const cart = (quantity: number) => ({
  groups: quantity ? [{ items: [{ quantity }] }] : [],
});

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
  });

  it("updates the count and bumps only when the count increases", async () => {
    requestMock
      .mockResolvedValueOnce(cart(2))
      .mockResolvedValueOnce(cart(3))
      .mockResolvedValueOnce(cart(2));
    const user = userEvent.setup();
    renderShopperShell();

    const initialBadge = await screen.findByLabelText("2 items");
    expect(initialBadge).not.toHaveClass("motion-safe:scale-110");

    await user.click(screen.getByRole("button", { name: "Refresh cart" }));
    const increasedBadge = await screen.findByLabelText("3 items");
    await waitFor(() =>
      expect(increasedBadge).toHaveClass("motion-safe:scale-110"),
    );

    await user.click(screen.getByRole("button", { name: "Refresh cart" }));
    const decreasedBadge = await screen.findByLabelText("2 items");
    expect(decreasedBadge).not.toHaveClass("motion-safe:scale-110");
  });
});
