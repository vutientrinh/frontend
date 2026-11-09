import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductSummary } from "../../commerce/types";
import { scrollStripClass } from "../lib";
import { ProductGrid } from "./ProductGrid";

/**
 * S-07 Deals: one horizontal row with scroll snap. Touch/trackpad scroll everywhere;
 * previous/next buttons from `sm` for mouse users. Smooth scrolling only without reduced motion.
 */
export function DealsCarousel({
  products,
  label,
}: {
  products: ProductSummary[];
  label: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  const button =
    "hidden h-11 w-11 place-items-center rounded-full border border-border bg-card hover:bg-muted sm:grid";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Scroll ${label} back`}
        onClick={() => scroll(-1)}
        className={button}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div
        ref={strip}
        className={`-mx-4 min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0 ${scrollStripClass}`}
      >
        <ProductGrid
          products={products}
          label={label}
          className="flex gap-3 sm:gap-4 [&>li]:w-[58%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-52 xl:[&>li]:w-56"
        />
      </div>
      <button
        type="button"
        aria-label={`Scroll ${label} forward`}
        onClick={() => scroll(1)}
        className={button}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
