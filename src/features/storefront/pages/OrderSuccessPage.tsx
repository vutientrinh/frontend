import { CircleCheck } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ErrorState } from "../../../components/shared";
import { useShopperOrders } from "../../commerce/api";
import type { CheckoutResult } from "../../commerce/types";
import { ListSkeleton } from "../components/States";
import { Amount } from "../components/Amount";
import { sumMoney } from "../lib";
import { type } from "../type";

/** W-18 Order success. Uses the checkout result when present, else loads the seller orders. */
export default function OrderSuccessPage() {
  const { orderId = "" } = useParams();
  const location = useLocation();
  const fromCheckout = (location.state as { checkout?: CheckoutResult } | null)
    ?.checkout;
  const orders = useShopperOrders({ size: 100 });
  const fetched = (orders.data?.content ?? []).filter(
    (o) => o.parentOrderId === orderId,
  );
  const sellerOrders =
    fromCheckout?.parentOrderId === orderId
      ? fromCheckout.sellerOrders
      : fetched.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          seller: o.seller,
          total: o.total,
        }));

  if (!sellerOrders.length) {
    if (orders.isError)
      return (
        <ErrorState
          message="Could not load your order."
          retry={() => void orders.refetch()}
        />
      );
    if (orders.isLoading)
      return <ListSkeleton rows={2} label="Loading order" />;
    return (
      <div className="py-10">
        <h1 className={type.h1}>Order not found</h1>
        <Link to="/me/orders" className="mt-4 inline-block text-primary">
          View my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <CircleCheck size={32} aria-hidden="true" className="text-success" />
        <h1 className={`mt-3 ${type.h1}`}>Order placed and paid</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fromCheckout ? `Order ${fromCheckout.orderNumber}. ` : ""}
          Each seller ships separately and confirms within 24 hours.
        </p>
      </header>
      <ul className="divide-y divide-border border-y border-border">
        {sellerOrders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{o.seller.name}</span>
              <code className="font-mono text-xs text-muted-foreground">
                {o.orderNumber}
              </code>
            </span>
            <Amount amount={o.total} />
            <Link
              to={`/me/orders/${o.id}`}
              className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
            >
              Track
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-medium">Total paid</span>
        <Amount
          amount={sumMoney(sellerOrders.map((o) => o.total))}
          className={type.h2}
        />
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/me/orders?tab=TO_SHIP"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          View orders
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
