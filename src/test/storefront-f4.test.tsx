import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Campaign } from "../features/commerce/types";
import { HeroCarousel } from "../features/storefront/components/HeroCarousel";
import { SearchBar } from "../features/storefront/components/SearchBar";

/** TASK-028 F4: campaign art follows the tone; one search box (the header's) mirrors `?q=`. */
const campaign = (id: string, tone: string, image: string) =>
  ({
    id,
    title: `${id} title`,
    subtitle: "Subtitle",
    ctaLabel: "Open",
    href: "/search",
    image,
    tone,
  }) as unknown as Campaign;

describe("campaign art (F4)", () => {
  it("tints one-colour SVG art with the tone and keeps photos as images", () => {
    const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h9v9z" fill="currentColor"/></svg>')}`;
    const { container } = render(
      <MemoryRouter>
        <HeroCarousel
          campaigns={[
            campaign("brand", "brand", svg),
            campaign("neutral", "neutral", svg),
            campaign("photo", "deal", "https://cdn.example.test/hero.jpg"),
          ]}
        />
      </MemoryRouter>,
    );
    const [brand, neutral] = [
      ...container.querySelectorAll<HTMLElement>('[data-art="mask"]'),
    ];
    expect(brand).toHaveClass("bg-primary-foreground");
    expect(brand.style.maskImage).toContain("data:image/svg+xml");
    // On the card surface the art takes the primary colour, so it shows in light and dark.
    expect(neutral).toHaveClass("bg-primary");
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.test/hero.jpg",
    );
  });
});

describe("search box (F4 re-check)", () => {
  it("shows the current query on /search and clears on other pages", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/search?q=lamp"]}>
        <SearchBar id="header-search" />
        <Routes>
          <Route path="/search" element={<Link to="/">Home</Link>} />
          <Route path="/" element={<Link to="/search?q=fan">Fans</Link>} />
        </Routes>
      </MemoryRouter>,
    );
    const box = screen.getByRole("searchbox", { name: "Search products" });
    expect(box).toHaveValue("lamp");
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(box).toHaveValue("");
    await user.type(box, "kettle");
    expect(box).toHaveValue("kettle");
    await user.click(screen.getByRole("link", { name: "Fans" }));
    expect(box).toHaveValue("fan");
  });
});
