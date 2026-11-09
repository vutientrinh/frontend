import { useState } from "react";
import { Banknote, CreditCard, Package, Store, Truck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiError } from "../../banking/client";
import {
  CopyButton,
  ErrorState,
  KeyValueList,
  Money,
  PageHeader,
  PaymentMethod,
  StatusBadge,
} from "../../../components/shared";
import { useCancelMarketplaceOrder, useMarketplaceOrder } from "../api";
import { NotFound, ReasonDialog, Section } from "../components";
import type { SagaEvent, SagaService } from "../types";

const SERVICES: { id: SagaService; label: string; Icon: typeof Store }[] = [
  { id: "commerce", label: "Commerce", Icon: Store },
  { id: "payment", label: "Payment", Icon: CreditCard },
  { id: "bank-sim", label: "Bank simulator", Icon: Banknote },
  { id: "carrier", label: "Carrier", Icon: Truck },
];
const CANCELLABLE = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PACKED"];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

function SagaTrace({ events }: { events: SagaEvent[] }) {
  const correlationId = events[0]?.correlationId;
  const groups = SERVICES.map((s) => ({
    ...s,
    events: events.filter((e) => e.service === s.id),
  })).filter((g) => g.events.length);
  return (
    <div className="space-y-4">
      {correlationId && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Correlation id</span>
          <code className="font-mono text-xs">{correlationId}</code>
          <CopyButton value={correlationId} />
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map(({ id, label, Icon, events: list }) => (
          <section key={id} aria-labelledby={`saga-${id}`}>
            <h3
              id={`saga-${id}`}
              className="mb-2 flex items-center gap-2 text-sm font-semibold"
            >
              <Icon size={16} aria-hidden="true" /> {label}
              <span className="font-normal text-muted-foreground">
                ({list.length})
              </span>
            </h3>
            <ol className="space-y-3 border-l border-border pl-4">
              {list.map((e, i) => (
                <li key={`${e.type}-${e.at}-${i}`} className="relative text-sm">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-border"
                  />
                  <p className="font-mono text-xs font-medium">{e.type}</p>
                  <p>{e.summary}</p>
                  <time
                    dateTime={e.at}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {when(e.at)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

/** A-15 Order detail: saga trace grouped by service, payment intent, shipment, cancel. */
export default function OrderDetailPage() {
  const { id = "" } = useParams();
  const order = useMarketplaceOrder(id);
  const cancel = useCancelMarketplaceOrder();
  const [cancelling, setCancelling] = useState(false);

  if (order.isError)
    return order.error instanceof ApiError && order.error.status === 404 ? (
      <NotFound what="Order" back="/admin/marketplace/orders" />
    ) : (
      <ErrorState retry={() => void order.refetch()} />
    );
  if (order.isLoading || !order.data)
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading order</span>
        <div className="h-8 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-60 rounded bg-muted motion-safe:animate-pulse" />
      </div>
    );
  const o = order.data;
  const paid = o.payment.status === "SUCCEEDED";
  const intent = o.paymentIntent;

  return (
    <>
      <Link
        to="/admin/marketplace/orders"
        className="text-sm text-primary hover:underline"
      >
        Marketplace orders
      </Link>
      <PageHeader
        title={`Order ${o.orderNumber}`}
        description={`Parent ${o.parentOrderNumber} · ${o.seller.name} · ${o.customer.name} (${o.customer.phone})`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={o.status} />
            {CANCELLABLE.includes(o.status) && (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="min-h-10 rounded-md border border-input px-4 text-sm font-medium text-destructive hover:bg-muted"
              >
                Cancel order
              </button>
            )}
          </div>
        }
      />
      <div className="space-y-8">
        <Section title="Saga trace">
          <SagaTrace events={o.sagaEvents} />
        </Section>
        <div className="grid gap-8 xl:grid-cols-3">
          <Section title="Payment intent">
            {intent ? (
              <KeyValueList
                items={[
                  {
                    label: "Intent",
                    value: (
                      <code className="font-mono text-xs">{intent.id}</code>
                    ),
                  },
                  {
                    label: "Method",
                    value: <PaymentMethod method={intent.method} />,
                  },
                  {
                    label: "Status",
                    value: <StatusBadge status={intent.status} />,
                  },
                  { label: "Amount", value: <Money amount={intent.amount} /> },
                  ...(intent.reference
                    ? [
                        {
                          label: "Reference",
                          value: (
                            <code className="font-mono text-xs">
                              {intent.reference}
                            </code>
                          ),
                        },
                      ]
                    : []),
                  ...(intent.failureReason
                    ? [{ label: "Failure", value: intent.failureReason }]
                    : []),
                  { label: "Expires", value: when(intent.expiresAt) },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No payment intent.
              </p>
            )}
          </Section>
          <Section title="Shipment">
            {o.shipment ? (
              <>
                <p className="text-sm">
                  {o.shipment.carrier} ·{" "}
                  <code className="font-mono text-xs">
                    {o.shipment.trackingNo}
                  </code>
                </p>
                <ol className="mt-2 space-y-1 text-sm">
                  {o.shipment.events.map((e) => (
                    <li key={`${e.status}-${e.at}`}>
                      <span className="font-medium">{e.status}</span>{" "}
                      <span className="text-muted-foreground">
                        {e.location} · {when(e.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package size={16} aria-hidden="true" /> Not shipped yet.
              </p>
            )}
          </Section>
          <Section title="Money">
            <KeyValueList
              items={[
                { label: "Items", value: <Money amount={o.money.gross} /> },
                { label: "Shipping", value: <Money amount={o.shippingFee} /> },
                {
                  label: "Commission",
                  value: <Money amount={o.money.commission} />,
                },
                {
                  label: "VAT on commission",
                  value: <Money amount={o.money.vatOnCommission} />,
                },
                {
                  label: "Net to seller",
                  value: <Money amount={o.money.net} />,
                },
                {
                  label: "Escrow",
                  value: <StatusBadge status={o.money.escrowStatus} />,
                },
                {
                  label: "Total paid by customer",
                  value: (
                    <strong>
                      <Money amount={o.total} />
                    </strong>
                  ),
                },
              ]}
            />
          </Section>
        </div>
        <Section title="Items">
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="p-2">
                    Product
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Unit price
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Qty
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item, i) => (
                  <tr
                    key={`${item.name}-${i}`}
                    className="border-t border-border"
                  >
                    <td className="p-2">
                      {item.name}
                      <span className="block text-xs text-muted-foreground">
                        {item.variantLabel}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <Money amount={item.unitPrice} />
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="p-2 text-right">
                      <Money amount={item.lineTotal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Ship to {o.shippingAddress.recipient}, {o.shippingAddress.phone},{" "}
            {o.shippingAddress.address}
          </p>
        </Section>
      </div>
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel order ${o.orderNumber}?`}
        description={
          paid ? (
            <>
              The customer is refunded <Money amount={o.total} /> to{" "}
              {o.payment.method === "WALLET"
                ? "their wallet"
                : "the original payment method"}{" "}
              and the stock goes back on sale. This cannot be undone.
            </>
          ) : (
            "The unpaid payment is cancelled and the stock goes back on sale. No money moves."
          )
        }
        confirmLabel={paid ? "Cancel and refund" : "Cancel order"}
        reasons={[
          "Customer request",
          "Seller cannot fulfil",
          "Suspected fraud",
        ]}
        onConfirm={async (reason) => {
          await cancel.mutateAsync({ id: o.id, reason });
          toast.success(`Order ${o.orderNumber} cancelled`);
        }}
      />
    </>
  );
}
