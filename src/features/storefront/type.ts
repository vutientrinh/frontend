/**
 * DESIGN.md §3 type scale for the storefront, on top of the `text-display|h1|h2|h3` utilities from
 * index.css (TASK-026 A). Rule: the checkout total and payment amount use `display`; nothing else on
 * those screens is larger.
 */
export const type = {
  display: "text-display font-bold tracking-[-0.02em]",
  h1: "text-h1 font-bold tracking-[-0.015em]",
  h2: "text-h2 font-semibold tracking-[-0.01em]",
  h3: "text-h3 font-semibold",
} as const;
