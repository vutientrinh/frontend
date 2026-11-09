import { MapPin, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProductSummary } from "../../commerce/types";
import { formatCount } from "../lib";
import { PriceTag } from "./PriceTag";
import { RatingStars } from "./RatingStars";

/** Summaries may carry `variantCount` (optional, TASK-020 Part B) to label the button up front. */
type CardProduct = ProductSummary & { variantCount?: number };

/**
 * Product tile (S-02). Fixed anatomy so every card in a row has the same height:
 * square image → 2-line title → price + pill (list price on a reserved line) → rating/sold →
 * footer pinned to the bottom (location + one button). The link covers image + title; the
 * button is a sibling (no nested interactive elements).
 */
export function ProductCard({
  product,
  onAddToCart,
  adding = false,
}: {
  product: CardProduct;
  onAddToCart?: (product: ProductSummary) => void;
  adding?: boolean;
}) {
  const href = `/p/${product.slug}`;
  const choose = (product.variantCount ?? 1) > 1;
  return (
    <article className="group relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-0.5">
      <Link
        to={href}
        className="block focus-visible:outline-offset-[-2px]"
        aria-describedby={`${product.id}-meta`}
      >
        <span className="relative block aspect-square overflow-hidden bg-muted">
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={320}
            className={`h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.03] ${product.inStock ? "" : "opacity-50"}`}
          />
          {!product.inStock && (
            <span className="absolute left-2 top-2 rounded-sm bg-background px-2 py-0.5 text-xs font-medium">
              Sold out
            </span>
          )}
        </span>
        <span className="line-clamp-2 min-h-10 px-3 pt-3 text-sm leading-5">
          {product.name}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-1">
        <PriceTag
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          layout="card"
        />
        <div
          id={`${product.id}-meta`}
          className="flex items-center gap-x-2 overflow-hidden whitespace-nowrap text-xs text-muted-foreground"
        >
          <RatingStars rating={product.rating} size={12} />
          <span>{formatCount(product.soldCount)} sold</span>
        </div>
        <div className="mt-auto space-y-2 pt-1">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{product.seller.location}</span>
          </p>
          {onAddToCart &&
            (product.inStock ? (
              <button
                type="button"
                disabled={adding}
                aria-label={
                  choose
                    ? `Choose options for ${product.name}`
                    : `Add ${product.name} to cart`
                }
                onClick={() => onAddToCart(product)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {choose ? (
                  <SlidersHorizontal size={16} aria-hidden="true" />
                ) : (
                  <ShoppingCart size={16} aria-hidden="true" />
                )}
                {adding ? "Adding…" : choose ? "Choose options" : "Add to cart"}
              </button>
            ) : (
              <button
                type="button"
                disabled
                aria-label={`${product.name} is sold out`}
                className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-border text-sm text-muted-foreground opacity-70"
              >
                Sold out
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
