import type { ReactNode } from "react";
import type { Money as MoneyValue } from "../../commerce/types";
import { isPositive } from "../lib";
import { Amount } from "./Amount";

/**
 * Cart totals (W-15). Shipping depends on the address and the carrier chosen at checkout, so
 * the cart never shows a "Total": it shows the items subtotal, any savings, and says shipping
 * comes next. `action` is the Check out control; `footnote` explains why it is blocked.
 */
export function CartSummary({
  itemCount,
  subtotal,
  savings,
  action,
  footnote,
}: {
  itemCount: number;
  subtotal: MoneyValue;
  savings?: MoneyValue;
  action: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="cart-summary-title"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="cart-summary-title" className="font-semibold">
        Order summary
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        {isPositive(savings) && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Savings</dt>
            <dd>
              <Amount amount={savings} sign="minus" />
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="text-muted-foreground">Added at checkout</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="font-medium">
            Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
          </dt>
          <dd className="text-xl font-semibold">
            <Amount amount={subtotal} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">{action}</div>
      {footnote && (
        <div className="mt-3 text-xs text-muted-foreground">{footnote}</div>
      )}
    </section>
  );
}

/** Mobile bottom bar (above the shopper tab bar): subtotal + the same Check out control. */
export function CartBar({
  itemCount,
  subtotal,
  action,
  footnote,
}: {
  itemCount: number;
  subtotal: MoneyValue;
  action: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-background px-4 py-3 md:hidden">
      {footnote && <div className="mb-2 text-xs">{footnote}</div>}
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className="block text-xs text-muted-foreground">
            Subtotal, {itemCount} {itemCount === 1 ? "item" : "items"} +
            shipping
          </span>
          <strong className="text-lg">
            <Amount amount={subtotal} />
          </strong>
        </p>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
