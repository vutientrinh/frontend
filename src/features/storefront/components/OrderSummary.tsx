import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { Money as MoneyValue } from "../../commerce/types";
import { isPositive } from "../lib";
import { type } from "../type";
import { Amount } from "./Amount";

/** Totals block for cart / checkout. `children` is the screen's primary action. */
export function OrderSummary({
  title = "Order summary",
  itemCount,
  itemsTotal,
  shippingTotal,
  discount,
  total,
  children,
  footnote,
  shippingNote = "Calculated at checkout",
  totalLabel = "Total",
  before,
  totalSize = "h3",
}: {
  title?: string;
  itemCount: number;
  itemsTotal: MoneyValue;
  /** Undefined = not known yet (cart): shown as "Calculated at checkout". */
  shippingTotal?: MoneyValue;
  discount?: MoneyValue;
  total: MoneyValue;
  children?: ReactNode;
  footnote?: ReactNode;
  /** Shown instead of a shipping amount while it is unknown. */
  shippingNote?: ReactNode;
  totalLabel?: string;
  /** Rendered above the totals (e.g. a voucher field). */
  before?: ReactNode;
  /** "display" on checkout: the total is the largest type on that screen (DESIGN.md §1). */
  totalSize?: "h3" | "display";
}) {
  return (
    <section
      aria-labelledby="order-summary-title"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="order-summary-title" className="font-semibold">
        {title}
      </h2>
      {before && <div className="mt-3">{before}</div>}
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Items ({itemCount})</dt>
          <dd>
            <Amount amount={itemsTotal} />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd>
            {shippingTotal === undefined ? (
              <span className="text-muted-foreground">{shippingNote}</span>
            ) : (
              <Amount amount={shippingTotal} />
            )}
          </dd>
        </div>
        {isPositive(discount) && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>
              <Amount amount={discount} sign="minus" />
            </dd>
          </div>
        )}
        <div
          className={cn(
            "flex justify-between gap-x-4 border-t border-border pt-3",
            totalSize === "display" ? "flex-wrap items-end" : "items-baseline",
          )}
        >
          <dt className="font-medium">{totalLabel}</dt>
          <dd
            className={cn(
              "ml-auto",
              totalSize === "display" ? type.display : type.h3,
            )}
          >
            <Amount amount={total} />
          </dd>
        </div>
      </dl>
      {children && <div className="mt-4">{children}</div>}
      {footnote && (
        <div className="mt-3 text-xs text-muted-foreground">{footnote}</div>
      )}
    </section>
  );
}
