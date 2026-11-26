import { MapPin, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductThumb } from "../../../components/ProductThumb";
import type { ProductSummary } from "../../commerce/types";
import { formatCount } from "../lib";
import { PriceTag } from "./PriceTag";
import { RatingStars } from "./RatingStars";

/** Summaries may carry `variantCount` (optional, TASK-020 Part B) to label the button up front. */
export type CardProduct = ProductSummary & { variantCount?: number };

/**
 * Presentational product tile (S-02), shared by the storefront and the seller preview
 * (TASK-036 B2). Fixed anatomy so every card in a row has the same height:
 * square image → 2-line title → price + pill (list price on a reserved line) → rating/sold →
 * footer pinned to the bottom (location + one button). No cart logic: the caller decides.
 *
 * - `href` makes image + title a link; without it they are plain text (preview).
 * - `onAddToCart` renders a live button; `showAction` renders the same button disabled
 *   (label "Add to cart" / "Choose options" from `variantCount`) for previews.
 */
export function ProductCardView({
  product,
  href,
  onAddToCart,
  adding = false,
  showAction = false,
}: {
  product: CardProduct;
  href?: string;
  onAddToCart?: (product: ProductSummary) => void;
  adding?: boolean;
  showAction?: boolean;
}) {
  const choose = (product.variantCount ?? 1) > 1;
  const showButton = !!onAddToCart || showAction;
  const media = (
    <>
      <span className="relative block">
        <ProductThumb
          src={product.imageUrl}
          soldOut={!product.inStock}
          rounded={false}
          className="w-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.03]"
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
    </>
  );
  return (
    <article className="group relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-0.5">
      {href ? (
        <Link
          to={href}
          className="block focus-visible:outline-offset-[-2px]"
          aria-describedby={`${product.id}-meta`}
        >
          {media}
        </Link>
      ) : (
        <div className="block">{media}</div>
      )}
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
          {showButton &&
            (product.inStock ? (
              <button
                type="button"
                disabled={adding || !onAddToCart}
                aria-label={
                  choose
                    ? `Choose options for ${product.name}`
                    : `Add ${product.name} to cart`
                }
                onClick={() => onAddToCart?.(product)}
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

/** Storefront product tile: `ProductCardView` linked to `/p/:slug`. */
export function ProductCard({
  product,
  onAddToCart,
  adding = false,
}: {
  product: CardProduct;
  onAddToCart?: (product: ProductSummary) => void;
  adding?: boolean;
}) {
  return (
    <ProductCardView
      product={product}
      href={`/p/${product.slug}`}
      onAddToCart={onAddToCart}
      adding={adding}
    />
  );
}
