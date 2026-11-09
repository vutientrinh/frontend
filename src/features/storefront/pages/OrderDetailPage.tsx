import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiError } from "../../banking/client";
import {
  ErrorState,
  KeyValueList,
  PaymentMethod,
  StatusBadge,
} from "../../../components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useShopperOrder, useShopperOrderAction } from "../../commerce/api";
import type { OrderDetail } from "../../commerce/types";
import {
  OrderActivity,
  OrderDetailSkeleton,
  OrderItemRow,
} from "../components/OrderDetailParts";
import { OrderProgress } from "../components/OrderProgress";
import { OrderSummary } from "../components/OrderSummary";
import { errorMessage } from "../hooks";
import { formatOrderDateTime, sumMoney } from "../lib";
import { type } from "../type";

const REASONS = [
  "Changed my mind",
  "Ordered by mistake",
  "Found a better price",
  "Delivery takes too long",
];

function CancelDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = useShopperOrderAction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    try {
      await action.mutateAsync({ id: order.id, action: "cancel", reason });
      toast.success(`Order ${order.orderNumber} cancelled`);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Could not cancel the order."));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Cancel order {order.orderNumber}?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          {order.status === "PENDING_PAYMENT"
            ? "The payment is cancelled and the items go back on sale."
            : "Your payment is refunded to the original method."}
        </DialogDescription>
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Reason</legend>
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                {r}
              </label>
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
            >
              Keep order
            </button>
            <button
              type="submit"
              disabled={action.isPending}
              className="min-h-11 rounded-md bg-destructive px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Cancel order
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** W-20 Order detail: progress, next step with help, items, one activity list, payment. */
export default function OrderDetailPage() {
  const { id = "" } = useParams();
  const order = useShopperOrder(id);
  const action = useShopperOrderAction();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (order.isError)
    return order.error instanceof ApiError && order.error.status === 404 ? (
      <div className="py-10">
        <h1 className={type.h1}>Order not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may belong to another account, or the link is incomplete.
        </p>
        <Link to="/me/orders" className="mt-4 inline-block text-primary">
          View my orders
        </Link>
      </div>
    ) : (
      <ErrorState
        message="Could not load this order."
        retry={() => void order.refetch()}
      />
    );
  if (order.isLoading || !order.data) return <OrderDetailSkeleton />;

  const o = order.data;
  const can = (a: (typeof o.actions)[number]) => o.actions.includes(a);
  const itemsTotal = sumMoney(o.items.map((i) => i.lineTotal));
  const hasActions = can("PAY") || can("CONFIRM_RECEIVED") || can("CANCEL");

  async function confirmReceived() {
    try {
      await action.mutateAsync({ id: o.id, action: "confirm-received" });
      toast.success("Thanks! The seller gets paid now.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not confirm."));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/me/orders"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            My orders
          </Link>
          <h1 className={type.h2}>
            Order{" "}
            <code className="font-mono text-[0.85em] font-semibold">
              {o.orderNumber}
            </code>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link
              to={`/shop/${o.seller.slug}`}
              className="font-medium text-foreground hover:underline"
            >
              {o.seller.name}
            </Link>
            , placed{" "}
            <time dateTime={o.createdAt}>
              {formatOrderDateTime(o.createdAt)}
            </time>
          </p>
        </div>
        <StatusBadge status={o.status} />
      </header>

      <section aria-label="Progress" className="border-y border-border py-4">
        <OrderProgress status={o.status} timeline={o.timeline} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-8">
          <section aria-labelledby="items-title">
            <h2 id="items-title" className={`mb-3 ${type.h3}`}>
              Items
            </h2>
            <ul className="divide-y divide-border border-y border-border">
              {o.items.map((item, i) => (
                <OrderItemRow key={`${item.name}-${i}`} item={item} />
              ))}
            </ul>
          </section>
          <OrderActivity order={o} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-4">
          {hasActions && (
            <section
              aria-labelledby="next-step-title"
              id="confirm"
              className="space-y-3 rounded-lg border border-border bg-card p-4"
            >
              <h2 id="next-step-title" className="font-semibold">
                Next step
              </h2>
              {can("PAY") && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Your items are reserved until the payment window closes.
                  </p>
                  <Link
                    to={`/pay/${o.payment.intentId}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Pay now
                  </Link>
                </>
              )}
              {can("CONFIRM_RECEIVED") && (
                <>
                  <p
                    id="confirm-help"
                    className="text-sm text-muted-foreground"
                  >
                    Confirming releases your payment to the seller. Only confirm
                    when you have all items and they are as described.
                  </p>
                  <button
                    type="button"
                    aria-describedby="confirm-help"
                    disabled={action.isPending}
                    onClick={() => void confirmReceived()}
                    className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Confirm received
                  </button>
                </>
              )}
              {can("CANCEL") && (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="min-h-11 w-full rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
                >
                  Cancel order
                </button>
              )}
            </section>
          )}
          <OrderSummary
            title="Payment"
            itemCount={o.itemCount}
            itemsTotal={itemsTotal}
            shippingTotal={o.shippingFee}
            discount={o.discount}
            total={o.total}
          >
            <KeyValueList
              items={[
                {
                  label: "Method",
                  value: <PaymentMethod method={o.payment.method} />,
                },
                {
                  label: "Status",
                  value: <StatusBadge status={o.payment.status} />,
                },
                ...(o.payment.paidAt
                  ? [
                      {
                        label: "Paid",
                        value: formatOrderDateTime(o.payment.paidAt),
                      },
                    ]
                  : []),
              ]}
            />
          </OrderSummary>
          <section
            aria-labelledby="address-title"
            className="border-t border-border pt-4 text-sm"
          >
            <h2 id="address-title" className="mb-2 font-semibold">
              Delivery address
            </h2>
            <p className="font-medium">
              {o.shippingAddress.recipient}{" "}
              <span className="font-normal text-muted-foreground">
                {o.shippingAddress.phone}
              </span>
            </p>
            <p className="text-muted-foreground">{o.shippingAddress.address}</p>
          </section>
        </div>
      </div>
      <CancelDialog order={o} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}
