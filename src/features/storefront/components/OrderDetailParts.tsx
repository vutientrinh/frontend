import { RotateCcw, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CopyButton } from "../../../components/shared";
import { useAddCartItem } from "../../commerce/api";
import type { OrderDetail } from "../../commerce/types";
import { addedToCartToast, errorMessage } from "../hooks";
import { activityOf, formatOrderDateTime } from "../lib";
import { type } from "../type";
import { Amount } from "./Amount";

/** Order lines may carry `productSlug` (optional, TASK-020 Part B) to link the product. */
export type OrderLine = OrderDetail["items"][number] & { productSlug?: string };

/** One merged timeline (status + tracking) with the carrier and tracking number on top. */
export function OrderActivity({ order }: { order: OrderDetail }) {
  const entries = activityOf(order);
  return (
    <section aria-labelledby="activity-title" id="tracking">
      <h2 id="activity-title" className={`mb-3 ${type.h3}`}>
        Activity
      </h2>
      {order.shipment && (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Truck
            size={16}
            aria-hidden="true"
            className="text-muted-foreground"
          />
          <span>{order.shipment.carrier}</span>
          <span className="text-muted-foreground">tracking number</span>
          <code className="font-mono">{order.shipment.trackingNo}</code>
          <CopyButton value={order.shipment.trackingNo} />
        </p>
      )}
      <ol className="space-y-4 border-l border-border pl-5">
        {entries.map((e, i) => (
          <li key={e.key} className="relative text-sm">
            <span
              aria-hidden="true"
              className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-border"}`}
            />
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className={i === 0 ? "font-semibold" : "font-medium"}>
                {e.title}
              </span>
              {e.kind === "shipment" && (
                <span className="text-xs text-muted-foreground">
                  Carrier scan
                </span>
              )}
            </p>
            {e.detail && <p className="text-muted-foreground">{e.detail}</p>}
            <time
              dateTime={e.at}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {formatOrderDateTime(e.at)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Item line: product link (when the slug is known), price × qty, Buy again. */
export function OrderItemRow({ item }: { item: OrderLine }) {
  const add = useAddCartItem();
  const navigate = useNavigate();
  async function buyAgain() {
    try {
      await add.mutateAsync({ variantId: item.variantId!, quantity: 1 });
      addedToCartToast(item.name, navigate);
    } catch (err) {
      toast.error(errorMessage(err, "This item is no longer available."));
    }
  }
  return (
    <li className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-3 p-3 text-sm sm:grid-cols-[72px_minmax(0,1fr)_auto]">
      <img
        src={item.imageUrl}
        alt=""
        width={72}
        height={72}
        className="aspect-square w-full rounded-md bg-muted object-cover"
      />
      <div className="min-w-0 space-y-1">
        {item.productSlug ? (
          <Link
            to={`/p/${item.productSlug}`}
            className="line-clamp-2 font-medium hover:underline"
          >
            {item.name}
          </Link>
        ) : (
          <span className="line-clamp-2 font-medium">{item.name}</span>
        )}
        <p className="text-xs text-muted-foreground">
          {item.variantLabel}
          {item.variantLabel && ", "}
          <span className="tabular-nums">
            <Amount amount={item.unitPrice} /> × {item.quantity}
          </span>
        </p>
        {item.variantId && (
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => void buyAgain()}
            aria-label={`Buy ${item.name} again`}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {add.isPending ? "Adding…" : "Buy again"}
          </button>
        )}
      </div>
      <p className="font-medium">
        <span className="sr-only">Line total </span>
        <Amount amount={item.lineTotal} />
      </p>
    </li>
  );
}

/** Same shape as the loaded page: header, progress band, two columns. */
export function OrderDetailSkeleton() {
  const pulse = "rounded bg-muted motion-safe:animate-pulse";
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading order</span>
      <div aria-hidden="true" className="space-y-6">
        <div className={`h-8 w-64 ${pulse}`} />
        <div className={`h-20 w-full ${pulse}`} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className={`h-64 ${pulse}`} />
          <div className={`h-48 ${pulse}`} />
        </div>
      </div>
    </div>
  );
}
