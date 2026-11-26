import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSplitLayout } from "../components/brand/AuthSplitLayout";
import type { Campaign } from "../features/commerce/types";
import {
  HERO_INTERVAL_MS,
  HeroCarousel,
} from "../features/storefront/components/HeroCarousel";

const campaigns = [
  { id: "a", title: "Brand slide", tone: "brand" },
  { id: "b", title: "Deal slide", tone: "deal" },
  { id: "c", title: "Neutral slide", tone: "neutral" },
].map((c) => ({
  ...c,
  subtitle: `${c.title} subtitle`,
  ctaLabel: `Open ${c.title}`,
  href: `/search?q=${c.id}`,
  image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
})) as unknown as Campaign[];

const mount = () =>
  render(
    <MemoryRouter>
      <HeroCarousel campaigns={campaigns} />
    </MemoryRouter>,
  );
const currentDot = () =>
  screen
    .getAllByRole("button", { name: /^Campaign \d of 3/ })
    .find((b) => b.getAttribute("aria-current") === "true");
const slides = () =>
  screen.getAllByRole("group").filter((g) => g.dataset.tone !== undefined);
const visibleSlide = () => slides().find((s) => !s.hasAttribute("inert"));
const tick = () =>
  act(() => {
    vi.advanceTimersByTime(HERO_INTERVAL_MS);
  });

describe("home hero carousel (TASK-029 A3)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is an APG carousel: labelled region, grouped slides, only the current one reachable", () => {
    mount();
    const region = screen.getByRole("region", { name: "Featured campaigns" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    expect(slides()).toHaveLength(3);
    expect(slides()[0]).toHaveAttribute("aria-label", "1 of 3");
    expect(slides()[0]).toHaveAttribute("aria-roledescription", "slide");
    expect(slides()[1]).toHaveAttribute("inert");
    expect(within(visibleSlide()!).getByRole("link")).toHaveAttribute(
      "href",
      "/search?q=a",
    );
  });

  it("auto-advances every 6 s and wraps around", () => {
    mount();
    expect(currentDot()).toHaveAccessibleName(/1 of 3: Brand slide/);
    tick();
    expect(currentDot()).toHaveAccessibleName(/2 of 3: Deal slide/);
    tick();
    tick();
    expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    expect(
      screen.getByText("Brand slide").closest("#hero-slides"),
    ).toHaveAttribute("aria-live", "off");
  });

  it("pauses on hover, on focus and with the pause button", () => {
    mount();
    const region = screen.getByRole("region", { name: "Featured campaigns" });
    fireEvent.mouseEnter(region);
    tick();
    expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    fireEvent.mouseLeave(region);

    fireEvent.focusIn(currentDot()!);
    tick();
    expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    fireEvent.focusOut(currentDot()!);

    fireEvent.click(screen.getByRole("button", { name: "Pause campaigns" }));
    tick();
    expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    expect(
      screen.getByRole("button", { name: "Play campaigns" }),
    ).toBeInTheDocument();
    // Not rotating: slide changes are announced.
    expect(document.getElementById("hero-slides")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("moves between dots with arrow keys, Home and End (roving focus)", () => {
    mount();
    const first = currentDot()!;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(currentDot()).toHaveAccessibleName(/2 of 3/);
    expect(currentDot()).toHaveFocus();
    fireEvent.keyDown(currentDot()!, { key: "End" });
    expect(currentDot()).toHaveAccessibleName(/3 of 3/);
    fireEvent.keyDown(currentDot()!, { key: "ArrowRight" });
    expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    fireEvent.keyDown(currentDot()!, { key: "ArrowLeft" });
    expect(currentDot()).toHaveAccessibleName(/3 of 3/);
    fireEvent.keyDown(currentDot()!, { key: "Home" });
    expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    const tabbable = screen
      .getAllByRole("button", { name: /^Campaign/ })
      .filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  it("uses the deal colour only on the deal tone", () => {
    mount();
    const [brand, deal, neutral] = slides();
    expect(brand.className).toContain("--brand-gradient");
    expect(deal.className).toContain("bg-deal");
    for (const s of [brand, neutral])
      expect(s.innerHTML).not.toMatch(/(bg|text)-deal/);
    expect(neutral.className).toContain("bg-card");
  });

  it("does not auto-advance under reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      mount();
      tick();
      expect(currentDot()).toHaveAccessibleName(/1 of 3/);
    } finally {
      window.matchMedia = original;
    }
  });

  it("shows a single campaign without controls", () => {
    render(
      <MemoryRouter>
        <HeroCarousel campaigns={campaigns.slice(0, 1)} />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: /Pause/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Brand slide" })).toBeVisible();
  });
});

describe("auth split screen (TASK-029 A4)", () => {
  it.each([
    ["shopper", "Shop and pay, one way.", "/"],
    ["seller", "Sell on Jadeway", "/seller/login"],
    ["staff", "Jadeway back office", "/admin/login"],
  ] as const)(
    "%s: brand panel with headline and logo link, form in main",
    (audience, headline, home) => {
      render(
        <MemoryRouter>
          <AuthSplitLayout audience={audience}>
            <h1>Sign in</h1>
          </AuthSplitLayout>
        </MemoryRouter>,
      );
      const panel = screen.getByRole("complementary", { name: "Jadeway" });
      expect(panel.className).toContain("--brand-gradient");
      expect(within(panel).getAllByText(headline).length).toBeGreaterThan(0);
      expect(within(panel).getByRole("link")).toHaveAttribute("href", home);
      expect(
        within(screen.getByRole("main")).getByRole("heading", {
          name: "Sign in",
        }),
      ).toBeInTheDocument();
    },
  );

  it("hides the floating fragments from assistive tech", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthSplitLayout>
          <p>form</p>
        </AuthSplitLayout>
      </MemoryRouter>,
    );
    const fragments = within(container).getByText("Payment received");
    expect(fragments.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
