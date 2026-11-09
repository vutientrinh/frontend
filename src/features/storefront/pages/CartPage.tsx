import { useState } from "react";
import Big from "big.js";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "../../../components/shared";
import {
  useCart,
  useCatalogHome,
  useDeleteCartItem,
  useUpdateCartItem,
} from "../../commerce/api";
import type { CartItem } from "../../commerce/types";
import { CartSellerGroup, type CartLine } from "../components/CartSellerGroup";
import { CartBar, CartSummary } from "../components/CartSummary";
import { ProductGrid } from "../components/ProductGrid";
import { EmptyCart, ListSkeleton } from "../components/States";
import { errorMessage, useMinWidth } from "../hooks";
import { type } from "../type";

/** Savings on the selected lines when the cart carries list prices (optional field). */
function savingsOf(lines: CartLine[]) {
  return lines
    .reduce(
      (sum, i) =>
        i.compareAtPrice && new Big(i.compareAtPrice).gt(i.unitPrice)
          ? sum.plus(
              new Big(i.compareAtPrice).minus(i.unitPrice).times(i.quantity),
            )
          : sum,
      new Big(0),
    )
    .toFixed(0);
}

/** Empty cart: say so, then give the shopper something to continue with. */
function EmptyCartPage() {
  const home = useCatalogHome();
  const picks = home.data?.recommended.slice(0, 8) ?? [];
  return (
    <div className="space-y-8">
      <h1 className={type.h1}>Cart</h1>
      <EmptyCart />
      {picks.length > 0 && (
        <section aria-labelledby="cart-recommended-title">
          <h2 id="cart-recommended-title" className={`mb-3 ${type.h3}`}>
            You might like
          </h2>
          <ProductGrid products={picks} label="Recommended products" />
        </section>
      )}
    </div>
  );
}

const continueLink =
  "inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline";

/** W-15 Cart: grouped by seller, select, quantity, price/stock warnings, checkout selected. */
export default function CartPage() {
  const cart = useCart();
  const update = useUpdateCartItem();
  const remove = useDeleteCartItem();
  const [busy, setBusy] = useState<string[]>([]);
  const desktop = useMinWidth(768);

  async function run(ids: string[], action: () => Promise<unknown>) {
    setBusy((b) => [...b, ...ids]);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update your cart."));
    } finally {
      setBusy((b) => b.filter((id) => !ids.includes(id)));
    }
  }

  if (cart.isError)
    return (
      <ErrorState
        message="Could not load your cart."
        retry={() => void cart.refetch()}
      />
    );
  if (cart.isLoading || !cart.data)
    return (
      <div className="space-y-4">
        <h1 className={type.h1}>Cart</h1>
        <ListSkeleton label="Loading cart" />
      </div>
    );

  const { groups, selectedCount, selectedSubtotal } = cart.data;
  if (!groups.length) return <EmptyCartPage />;

  const items: CartLine[] = groups.flatMap((g) => g.items);
  const selected = items.filter((i) => i.selected && i.available);
  const priceChanged = items.some((i) => i.priceChangedFrom);
  const overStock = selected.filter((i) => i.quantity > i.stock);
  const selectedLines = selected.length;
  const blocked = !selectedLines || overStock.length > 0;

  const toggleItems = (list: CartItem[], value: boolean) =>
    run(
      list.map((i) => i.id),
      () =>
        Promise.all(
          list
            .filter((i) => i.available && i.selected !== value)
            .map((i) => update.mutateAsync({ id: i.id, selected: value })),
        ),
    );

  const footnote =
    overStock.length > 0 ? (
      <span role="alert" className="text-destructive">
        Lower the quantity of {overStock.map((i) => i.name).join(", ")} to
        continue.
      </span>
    ) : !selectedLines ? (
      "Select the items you want to buy now."
    ) : undefined;
  const checkoutClass =
    "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:opacity-90";
  const action = blocked ? (
    <button
      type="button"
      disabled
      className={`${checkoutClass} cursor-not-allowed opacity-50`}
    >
      Check out ({selectedCount})
    </button>
  ) : (
    <Link to="/checkout" className={checkoutClass}>
      Check out ({selectedCount})
    </Link>
  );

  return (
    <div className="space-y-5 pb-40 md:pb-0">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className={type.h1}>Cart</h1>
          <Link to="/" className={continueLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Continue shopping
          </Link>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--primary)]"
            checked={
              selected.length > 0 &&
              selected.length === items.filter((i) => i.available).length
            }
            onChange={(e) => void toggleItems(items, e.target.checked)}
          />
          Select all
        </label>
      </header>
      {priceChanged && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-sm"
        >
          <CircleAlert
            size={18}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <p>
            Some prices changed since you added these items. Check the new
            prices below before you check out.
          </p>
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <div className="space-y-4">
          {groups.map((group) => (
            <CartSellerGroup
              key={group.seller.id}
              seller={group.seller}
              items={group.items}
              busyItemIds={busy}
              onToggleItem={(id, value) =>
                void run([id], () =>
                  update.mutateAsync({ id, selected: value }),
                )
              }
              onToggleAll={(value) => void toggleItems(group.items, value)}
              onQuantityChange={(id, quantity) =>
                void run([id], () => update.mutateAsync({ id, quantity }))
              }
              onRemove={(item) =>
                void run([item.id], async () => {
                  await remove.mutateAsync(item.id);
                  toast.success(`Removed ${item.name}`);
                })
              }
            />
          ))}
        </div>
        {desktop ? (
          <div className="mt-6 lg:sticky lg:top-4 lg:mt-0">
            <CartSummary
              itemCount={selectedCount}
              subtotal={selectedSubtotal}
              savings={savingsOf(selected)}
              action={action}
              footnote={footnote}
            />
          </div>
        ) : (
          <CartBar
            itemCount={selectedCount}
            subtotal={selectedSubtotal}
            action={action}
            footnote={footnote}
          />
        )}
      </div>
    </div>
  );
}
