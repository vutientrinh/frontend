import { describe, expect, it } from "vitest";
import { storefrontPublicRoutes } from "../../features/storefront/routes";
import { commerceHandlers } from "../../mocks/commerce";
import { server } from "../setup";

describe("campaign endpoint", () => {
  it("returns three public campaigns with the documented fields and token tones", async () => {
    server.use(...commerceHandlers);

    const response = await fetch(
      new URL("/api/campaigns", window.location.origin),
    );
    expect(response.status).toBe(200);

    const campaigns: unknown = await response.json();
    expect(campaigns).toHaveLength(3);
    const items = campaigns as Record<string, unknown>[];
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        ["id", "title", "subtitle", "ctaLabel", "href", "image", "tone"].sort(),
      );
      expect(item).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          subtitle: expect.any(String),
          ctaLabel: expect.any(String),
          href: expect.any(String),
          image: expect.any(String),
          tone: expect.stringMatching(/^(brand|deal|neutral)$/),
        }),
      );
    }
    expect(items.map(({ tone }) => tone)).toEqual(["brand", "deal", "neutral"]);

    const storefrontPaths = new Set(
      storefrontPublicRoutes.map((route) =>
        route.index ? "/" : `/${String(route.path)}`,
      ),
    );
    for (const item of items) {
      const target = new URL(String(item.href), window.location.origin);
      expect(storefrontPaths.has(target.pathname)).toBe(true);
      expect(target.pathname).toBe("/search");
      expect(target.searchParams.get("category")).toBeTruthy();

      const [dataUri, encodedSvg] = String(item.image).split(",", 2);
      expect(dataUri).toBe("data:image/svg+xml");
      const svg = decodeURIComponent(encodedSvg ?? "");
      expect(svg).toContain("<svg");
      expect(svg).toContain("<path");
      expect(svg).toContain('fill="currentColor"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).not.toMatch(/(?:fill|stroke)="white"/);
      expect(svg).not.toMatch(/<(?:rect|circle)\b/);
    }
  });
});
