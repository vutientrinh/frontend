import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Illustration } from "../components/brand/Illustration";
import {
  illustrationNames,
  loadIllustration,
} from "../components/brand/illustrations";
import { BrandMark, Logo } from "../components/brand/Logo";
import { EmptyState } from "../components/shared";
import { brand, pageTitle } from "../config/brand";
import {
  EmptyCart,
  NoOrders,
  NoResults,
  StoreNotFound,
} from "../features/storefront/components/States";
import { SavedAddressPicker } from "../features/storefront/components/SavedAddressPicker";

describe("brand config", () => {
  it("names the product Jadeway and builds page titles from it", () => {
    expect(brand.name).toBe("Jadeway");
    expect(pageTitle("Cart")).toBe("Cart | Jadeway");
    expect(pageTitle()).toBe("Jadeway");
  });

  it("renders the lockup with the name as text and a labelled mark when alone", () => {
    const { rerender } = render(<Logo />);
    expect(screen.getByText("Jadeway")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(<Logo showWordmark={false} />);
    expect(screen.getByRole("img", { name: "Jadeway" })).toBeInTheDocument();
    rerender(<BrandMark />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("illustration kit", () => {
  it("has a recoloured SVG file for every name (no unDraw purple left)", async () => {
    expect(illustrationNames).toHaveLength(15);
    for (const name of illustrationNames) {
      const svg = await loadIllustration(name);
      expect(svg, name).toMatch(/^<svg /);
      expect(svg, name).toContain("var(--primary)");
      expect(svg.toLowerCase(), name).not.toContain("#6c63ff");
      expect(svg, name).toContain('aria-hidden="true"');
    }
  });

  it("renders the scene hidden from assistive tech, in a fixed-height box", async () => {
    const { container } = render(<Illustration name="empty-cart" size="lg" />);
    const box = container.querySelector('[data-illustration="empty-cart"]');
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveClass("h-56");
    await waitFor(() => expect(box?.querySelector("svg")).not.toBeNull());
  });

  it("swaps the scene when the name changes", async () => {
    const { container, rerender } = render(<Illustration name="offline" />);
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
    rerender(<Illustration name="error-not-found" />);
    const box = container.querySelector("[data-illustration]");
    expect(box).toHaveAttribute("data-illustration", "error-not-found");
    const expected = await loadIllustration("error-not-found");
    const viewBox = /viewBox="([^"]+)"/.exec(expected)?.[1];
    await waitFor(() =>
      expect(box?.querySelector("svg")?.getAttribute("viewBox")).toBe(viewBox),
    );
  });

  it("EmptyState shows an illustration only when asked", () => {
    const { container, rerender } = render(<EmptyState title="Nothing" />);
    expect(container.querySelector("[data-illustration]")).toBeNull();
    rerender(<EmptyState title="Nothing" illustration="empty-queue" />);
    expect(
      container.querySelector('[data-illustration="empty-queue"]'),
    ).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Nothing" })).toBeVisible();
  });

  it("storefront empty states use the matching scenes", () => {
    const { container } = render(
      <MemoryRouter>
        <EmptyCart />
        <NoResults query="lamp" onClear={vi.fn()} />
        <NoOrders />
      </MemoryRouter>,
    );
    const names = [...container.querySelectorAll("[data-illustration]")].map(
      (el) => el.getAttribute("data-illustration"),
    );
    expect(names).toEqual(["empty-cart", "empty-search", "empty-orders"]);
    expect(
      screen.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeInTheDocument();
  });

  it("storefront not-found and empty-address states use their scenes (TASK-028 F4 S3)", () => {
    const { container } = render(
      <MemoryRouter>
        <StoreNotFound
          title="Order not found"
          to="/me/orders"
          linkLabel="View my orders"
        />
        <SavedAddressPicker
          addresses={[]}
          onChange={vi.fn()}
          onAddNew={vi.fn()}
        />
      </MemoryRouter>,
    );
    const names = [...container.querySelectorAll("[data-illustration]")].map(
      (el) => el.getAttribute("data-illustration"),
    );
    expect(names).toEqual(["error-not-found", "empty-addresses"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Order not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View my orders" }),
    ).toHaveAttribute("href", "/me/orders");
    expect(screen.getByRole("button", { name: "Add address" })).toBeVisible();
  });
});
