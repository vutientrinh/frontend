import {
  ChevronRight,
  CircleAlert,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Big from "big.js";
import { Link } from "react-router-dom";
import type {
  CartItem,
  Money as MoneyValue,
  SellerRef,
} from "../../commerce/types";
import { lineTotal } from "../lib";
import { QuantityStepper } from "./QuantityStepper";
import { Amount } from "./Amount";

const LOW_STOCK = 5;

function ItemNotice({ item }: { item: CartItem }) {
  // Checked first: the mock reports quantity > stock as unavailable, which is fixable.
  if (item.stock > 0 && item.quantity > item.stock)
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <CircleAlert size={14} aria-hidden="true" />
        Only {item.stock} left — lower the quantity
      </p>
    );
  if (!item.available)
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <CircleAlert size={14} aria-hidden="true" />
        No longer available
      </p>
    );
  if (item.priceChangedFrom) {
    const up = new Big(item.unitPrice).gt(item.priceChangedFrom);
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <p
        className={`flex flex-wrap items-center gap-1 text-xs ${up ? "text-warning" : "text-success"}`}
      >
        <Icon size={14} aria-hidden="true" />
        Price {up ? "went up" : "dropped"} from{" "}
        <Amount amount={item.priceChangedFrom} />
      </p>
    );
  }
  if (item.stock <= LOW_STOCK)
    return <p className="text-xs text-warning">Only {item.stock} left</p>;
  return null;
}

/**
 * Optional field the cart may carry (TASK-020 Part B): the list price, used for the savings
 * line and a struck-through price. Absent = no saving shown.
 */
export type CartLine = CartItem & { compareAtPrice?: MoneyValue };

/** md+ row grid, shared by the column labels and the rows so they line up. */
const rowGrid =
  "md:grid-cols-[auto_72px_minmax(0,1fr)_8rem_auto_8rem] md:items-start";

/**
 * One seller's block in the cart. Rows align on md+ as columns:
 * select · 72px thumb · name/variant/notice · unit price · quantity · line total.
 * On mobile the price, stepper and line total wrap under the name.
 */
export function CartSellerGroup({
  seller,
  items,
  busyItemIds = [],
  onToggleItem,
  onToggleAll,
  onQuantityChange,
  onRemove,
}: {
  seller: SellerRef;
  items: CartLine[];
  busyItemIds?: string[];
  onToggleItem: (itemId: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (item: CartItem) => void;
}) {
  const selectable = items.filter((i) => i.available);
  const selectedCount = selectable.filter((i) => i.selected).length;
  const all = selectable.length > 0 && selectedCount === selectable.length;
  const some = selectedCount > 0 && !all;
  const groupId = `cart-seller-${seller.id}`;
  return (
    <section
      aria-labelledby={`${groupId}-title`}
      className="rounded-lg border border-border bg-card"
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-1">
        <input
          id={`${groupId}-all`}
          type="checkbox"
          className="h-5 w-5 accent-[var(--primary)]"
          checked={all}
          disabled={!selectable.length}
          ref={(el) => {
            if (el) el.indeterminate = some;
          }}
          onChange={() => onToggleAll(!all)}
          aria-label={`Select all items from ${seller.name}`}
        />
        <Store size={16} aria-hidden="true" className="text-muted-foreground" />
        <h2 id={`${groupId}-title`} className="min-w-0 flex-1 truncate">
          <Link
            to={`/shop/${seller.slug}`}
            className="inline-flex min-h-11 items-center gap-1 font-semibold hover:underline"
          >
            {seller.name}
            <ChevronRight
              size={16}
              aria-hidden="true"
              className="text-muted-foreground"
            />
          </Link>
        </h2>
      </header>
      {/* Column labels for sighted users on md+; each cell has its own sr-only label. */}
      <div
        aria-hidden="true"
        className={`hidden border-b border-border px-4 py-2 text-xs text-muted-foreground md:grid ${rowGrid}`}
      >
        <span className="w-5" />
        <span className="col-span-2">Product</span>
        <span className="text-right">Unit price</span>
        <span className="text-center">Quantity</span>
        <span className="text-right">Total</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const busy = busyItemIds.includes(item.id);
          const href = `/p/${item.productSlug}`;
          const showCompare =
            !!item.compareAtPrice &&
            new Big(item.compareAtPrice).gt(item.unitPrice);
          return (
            <li
              key={item.id}
              aria-busy={busy || undefined}
              className={`grid grid-cols-[auto_72px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-4 ${rowGrid} ${item.available ? "" : "opacity-70"}`}
            >
              <input
                type="checkbox"
                className="mt-6 h-5 w-5 accent-[var(--primary)]"
                checked={item.selected && item.available}
                disabled={!item.available || busy}
                onChange={(e) => onToggleItem(item.id, e.target.checked)}
                aria-label={`Select ${item.name}, ${item.variantLabel}`}
              />
              <Link
                to={href}
                tabIndex={-1}
                aria-hidden="true"
                className="block"
              >
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  width={72}
                  height={72}
                  className="aspect-square w-[72px] rounded-md bg-muted object-cover"
                />
              </Link>
              <div className="min-w-0 space-y-1">
                <Link
                  to={href}
                  className="line-clamp-2 text-sm font-medium hover:underline md:text-base"
                >
                  {item.name}
                </Link>
                {item.variantLabel && (
                  <p className="text-xs text-muted-foreground md:text-sm">
                    {item.variantLabel}
                  </p>
                )}
                <ItemNotice item={item} />
                <RemoveButton item={item} disabled={busy} onRemove={onRemove} />
              </div>
              {/* Mobile: unit price, then stepper + line total, under the thumbnail.
                  md+: three aligned columns. */}
              <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 md:contents">
                <p className="basis-full text-sm tabular-nums md:basis-auto md:pt-2.5 md:text-right md:text-base">
                  <span className="sr-only">Unit price </span>
                  <Amount
                    amount={item.unitPrice}
                    tone={showCompare ? "deal" : "default"}
                  />
                  {showCompare && (
                    <s className="ml-2 text-xs text-muted-foreground md:ml-0 md:block">
                      <span className="sr-only">List price </span>
                      <Amount amount={item.compareAtPrice!} />
                    </s>
                  )}
                </p>
                <div className="md:justify-self-center">
                  {item.stock > 0 && (
                    <QuantityStepper
                      id={`qty-${item.id}`}
                      label={`Quantity of ${item.name}`}
                      value={item.quantity}
                      max={item.stock}
                      disabled={busy}
                      onChange={(q) => onQuantityChange(item.id, q)}
                    />
                  )}
                </div>
                <p className="ml-auto font-semibold tabular-nums md:ml-0 md:pt-2.5 md:text-right md:text-base">
                  <span className="sr-only">Line total </span>
                  <Amount amount={lineTotal(item.unitPrice, item.quantity)} />
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RemoveButton({
  item,
  disabled,
  onRemove,
}: {
  item: CartItem;
  disabled: boolean;
  onRemove: (item: CartItem) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Remove ${item.name} from cart`}
      onClick={() => onRemove(item)}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <Trash2 size={16} aria-hidden="true" />
      Remove
    </button>
  );
}
