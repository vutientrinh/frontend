/**
 * The product's identity, in one place (DESIGN.md §7–8, DESIGN-PLAN-v2 §2.1).
 * Every title, header, footer and meta tag reads the name from here; never hard-code it.
 * `index.html` repeats the name once in its static <title> (it can't import TS); keep the two in sync.
 */
export const brand = {
  name: "Jadeway",
  /** Where space is tight: app icon label, PWA short_name. */
  shortName: "Jadeway",
  tagline: "Shop and pay, one way.",
  /** Files in `frontend/public` (sources: `docs/design/brand/`). */
  assets: {
    logo: "/logo.svg",
    logoMono: "/logo-mono.svg",
    wordmark: "/wordmark.svg",
    favicon: "/favicon.svg",
    appleTouchIcon: "/apple-touch-icon.png",
    icon512: "/icon-512.png",
  },
} as const;

/** `document.title` for a page: "Cart | Jadeway"; the bare name when there is no page title. */
export function pageTitle(title?: string): string {
  return title ? `${title} | ${brand.name}` : brand.name;
}
