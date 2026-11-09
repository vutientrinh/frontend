import { ChevronRight, Store } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorState, StatusBadge } from "../../../components/shared";
import { useShopperOrders } from "../../commerce/api";
import type { ShopperOrder, ShopperOrderTab } from "../../commerce/types";
import { Pager } from "../components/Pager";
import { ListSkeleton, NoOrders } from "../components/States";
import { useBuyAgain, useOrderTabCounts } from "../hooks";
import { Amount } from "../components/Amount";
import { formatOrderDate } from "../lib";
import { type } from "../type";

const ORDER_TABS: { value: ShopperOrderTab | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "TO_PAY", label: "To pay" },
  { value: "TO_SHIP", label: "To ship" },
  { value: "SHIPPING", label: "Shipping" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "RETURNS", label: "Returns" },
  { value: "CANCELLED", label: "Cancelled" },
];

const primaryClass =
  "inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";
const secondaryClass =
  "inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted";

/** One primary action per order state; everything else is on the detail page. */
function PrimaryAction({
  order,
  buyAgain,
  buying,
}: {
  order: ShopperOrder;
  buyAgain: (id: string) => void;
  buying: boolean;
}) {
  const detail = `/me/orders/${order.id}`;
  const label = (verb: string) => `${verb}: order ${order.orderNumber}`;
  if (order.actions.includes("PAY"))
    return (
      <Link
        to={`/pay/${order.paymentIntentId}`}
        aria-label={label("Pay now")}
        className={primaryClass}
      >
        Pay now
      </Link>
    );
  if (order.actions.includes("CONFIRM_RECEIVED"))
    return (
      <Link
        to={`${detail}#confirm`}
        aria-label={label("Confirm received")}
        className={primaryClass}
      >
        Confirm received
      </Link>
    );
  if (order.actions.includes("TRACK"))
    return (
      <Link
        to={`${detail}#tracking`}
        aria-label={label("Track")}
        className={primaryClass}
      >
        Track
      </Link>
    );
  if (["COMPLETED", "CANCELLED", "REFUNDED", "RETURNED"].includes(order.status))
    return (
      <button
        type="button"
        disabled={buying}
        onClick={() => buyAgain(order.id)}
        aria-label={label("Buy again")}
        className={primaryClass}
      >
        {buying ? "Adding…" : "Buy again"}
      </button>
    );
  return null;
}

/** One order as a full-bleed list row (DESIGN.md §4: lists are lists, not cards). */
function OrderRow({
  order,
  buyAgain,
  buying,
}: {
  order: ShopperOrder;
  buyAgain: (id: string) => void;
  buying: boolean;
}) {
  const href = `/me/orders/${order.id}`;
  const first = order.itemsPreview[0];
  const more = order.itemsPreview.length - 1;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4">
        <Link
          to={`/shop/${order.seller.slug}`}
          className="inline-flex min-h-11 min-w-0 items-center gap-2 font-medium hover:underline"
        >
          <Store
            size={16}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          />
          <span className="truncate">{order.seller.name}</span>
        </Link>
        <time
          dateTime={order.createdAt}
          className="text-sm text-muted-foreground"
        >
          {formatOrderDate(order.createdAt)}
        </time>
        <span className="ml-auto">
          <StatusBadge status={order.status} />
        </span>
      </div>
      <Link to={href} className="flex gap-3 px-4 py-3 hover:bg-muted">
        <img
          src={first?.imageUrl}
          alt=""
          width={72}
          height={72}
          className="h-[72px] w-[72px] shrink-0 rounded-md bg-muted object-cover"
        />
        <span className="min-w-0 flex-1 text-sm">
          <span className="line-clamp-2 font-medium">{first?.name}</span>
          <span className="block text-xs text-muted-foreground">
            {first?.variantLabel} × {first?.quantity}
          </span>
          {more > 0 && (
            <span className="block text-xs text-muted-foreground">
              and {more} more {more === 1 ? "product" : "products"}
            </span>
          )}
          <code className="mt-1 block text-xs text-muted-foreground">
            {order.orderNumber}
          </code>
        </span>
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="mt-1 shrink-0 self-center text-muted-foreground"
        />
      </Link>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2 [&>a]:flex-1 [&>a]:justify-center [&>button]:flex-1 sm:[&>a]:flex-none sm:[&>button]:flex-none">
        <p className="basis-full text-sm sm:mr-auto sm:basis-auto">
          <span className="text-muted-foreground">
            Total ({order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            ){" "}
          </span>
          <strong>
            <Amount amount={order.total} />
          </strong>
        </p>
        <Link
          to={href}
          aria-label={`View details: order ${order.orderNumber}`}
          className={secondaryClass}
        >
          View details
        </Link>
        <PrimaryAction order={order} buyAgain={buyAgain} buying={buying} />
      </div>
    </li>
  );
}

/** W-19 My orders: "All" by default, counts on tabs, tab and page in the URL. */
export default function MyOrdersPage() {
  const [params, setParams] = useSearchParams();
  const current =
    ORDER_TABS.find((t) => t.value && t.value === params.get("tab")) ??
    ORDER_TABS[0];
  const tab = current.value;
  const page = Math.max(0, Number(params.get("page")) || 0);
  const orders = useShopperOrders({
    ...(tab ? { tab } : {}),
    page,
    size: 10,
  });
  const counts = useOrderTabCounts(ORDER_TABS.map((t) => t.value));
  const { buyAgain, pendingId } = useBuyAgain();

  return (
    <div className="space-y-5">
      <h1 className={type.h1}>My orders</h1>
      <nav
        aria-label="Order status"
        className="relative -mx-4 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-24px),transparent)] [scrollbar-width:none] sm:mx-0 sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max gap-1 border-b border-border">
          {ORDER_TABS.map((t, i) => {
            const active = t.value === tab;
            const count = counts[i];
            return (
              <li key={t.label} className="shrink-0">
                <Link
                  to={{ search: t.value ? `?tab=${t.value}` : "" }}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    count === undefined
                      ? undefined
                      : `${t.label} (${count} ${count === 1 ? "order" : "orders"})`
                  }
                  className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm ${active ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                  {count !== undefined && (
                    <span
                      aria-hidden="true"
                      className={`min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {orders.isError ? (
        <ErrorState
          message="Could not load your orders."
          retry={() => void orders.refetch()}
        />
      ) : orders.isLoading || !orders.data ? (
        <ListSkeleton label="Loading orders" />
      ) : orders.data.content.length === 0 ? (
        <NoOrders tabLabel={tab ? current.label : undefined} />
      ) : (
        <>
          <ul
            className="-mx-4 divide-y divide-border border-y border-border sm:mx-0"
            aria-label={`${current.label} orders`}
          >
            {orders.data.content.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                buyAgain={(id) => void buyAgain(id)}
                buying={pendingId === o.id}
              />
            ))}
          </ul>
          <Pager
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            onPage={(n) => {
              const next: Record<string, string> = tab ? { tab } : {};
              if (n) next.page = String(n);
              setParams(next);
            }}
          />
        </>
      )}
    </div>
  );
}
