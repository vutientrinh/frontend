import { cn } from "../../../lib/utils";
import type { Money as MoneyValue } from "../../commerce/types";
import { discountPercent } from "../lib";
import { Amount } from "./Amount";

/** Discount chip: the only `deal-muted` surface (DESIGN.md §2, lotus accent). */
function DiscountChip({
  percent,
  large,
}: {
  percent: number;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm bg-deal-muted px-1.5 font-semibold text-deal",
        large ? "text-sm" : "text-xs",
      )}
    >
      <span aria-hidden="true">−{percent}%</span>
      <span className="sr-only">{percent}% off</span>
    </span>
  );
}

/**
 * Product price. A sale price is set in `deal`; the struck list price stays muted.
 * Without a discount the price is plain foreground: deal colour is earned, not default.
 */
export function PriceTag({
  price,
  compareAtPrice,
  size = "md",
  layout = "inline",
  className,
}: {
  price: MoneyValue;
  compareAtPrice?: MoneyValue;
  size?: "sm" | "md" | "lg";
  /** "card": price + discount pill on one line, list price on a reserved second line. */
  layout?: "inline" | "card";
  className?: string;
}) {
  const discount = discountPercent(price, compareAtPrice);
  const tone = discount !== null ? "deal" : "default";
  if (layout === "card")
    return (
      <div className={cn("min-w-0", className)}>
        <p className="flex items-center gap-2 whitespace-nowrap">
          <span className="truncate text-base font-semibold">
            <span className="sr-only">Price </span>
            <Amount amount={price} tone={tone} />
          </span>
          {discount !== null && <DiscountChip percent={discount} />}
        </p>
        <p className="h-4 text-xs leading-4 text-muted-foreground">
          {discount !== null && compareAtPrice && (
            <s>
              <span className="sr-only">Original price </span>
              <Amount amount={compareAtPrice} />
            </s>
          )}
        </p>
      </div>
    );
  return (
    <p
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
    >
      <span
        className={cn(
          "font-semibold",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-h1 tracking-[-0.015em]",
        )}
      >
        <span className="sr-only">Price </span>
        <Amount amount={price} tone={tone} />
      </span>
      {discount !== null && compareAtPrice && (
        <>
          <s
            className={cn(
              "text-muted-foreground",
              size === "lg" ? "text-base" : "text-xs",
            )}
          >
            <span className="sr-only">Original price </span>
            <Amount amount={compareAtPrice} />
          </s>
          <DiscountChip percent={discount} large={size === "lg"} />
        </>
      )}
    </p>
  );
}
