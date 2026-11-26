/**
 * The illustration kit (DESIGN.md §8, plan §5.3). Same names on web and app.
 * Files: `src/assets/illustrations/<name>.svg` (unDraw, recoloured to tokens; see docs/design/assets.md).
 * Use only on empty / success / error states, auth, onboarding and the hero, never on lists, tables or forms.
 */
export const illustrationNames = [
  "empty-cart",
  "empty-orders",
  "empty-search",
  "empty-notifications",
  "empty-statement",
  "empty-wishlist",
  "empty-addresses",
  "empty-seller-products",
  "empty-queue",
  "offline",
  "success-payment",
  "success-order",
  "success-transfer",
  "error-generic",
  "error-not-found",
] as const;

export type IllustrationName = (typeof illustrationNames)[number];

const loaders = import.meta.glob<string>("../../assets/illustrations/*.svg", {
  query: "?raw",
  import: "default",
});

const cache = new Map<IllustrationName, string>();

export function cachedIllustration(name: IllustrationName): string | undefined {
  return cache.get(name);
}

/** Loads one SVG on demand (each file is its own small chunk, ~2–11 kB). */
export async function loadIllustration(
  name: IllustrationName,
): Promise<string> {
  const hit = cache.get(name);
  if (hit) return hit;
  const loader = loaders[`../../assets/illustrations/${name}.svg`];
  if (!loader) throw new Error(`Unknown illustration: ${name}`);
  const svg = await loader();
  cache.set(name, svg);
  return svg;
}
