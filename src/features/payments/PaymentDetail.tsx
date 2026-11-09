import { humanLabel } from "../../lib/labels";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  RelativeTime,
  StatusBadge,
  CopyButton,
  PaymentMethod,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
import { products } from "../transactions/lookups";
const transitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};
export default function PaymentDetail() {
  const { id = "" } = useParams(),
    client = useQueryClient(),
    [target, setTarget] = useState("");
  useEffect(() => {
    document.title = "Payment detail | Payment Project";
  }, []);
  const payment = useQuery({
    queryKey: ["payment", id],
    queryFn: async () => {
      const r = await api.GET("/payments/{id}", { params: { path: { id } } });
      if (r.error) throw r.error;
      return r.data;
    },
    refetchInterval: (q) =>
      ["PENDING", "PROCESSING"].includes(q.state.data?.status ?? "")
        ? 2000
        : false,
  });
  const live = ["PENDING", "PROCESSING"].includes(payment.data?.status ?? "");
  const orderSummary = useQuery({
    queryKey: ["payment-order-summary", payment.data?.orderId],
    enabled: !!payment.data?.orderId,
    queryFn: async () => {
      const [order, catalog] = await Promise.all([
        api.GET("/orders/{id}", {
          params: { path: { id: payment.data!.orderId } },
        }),
        products(),
      ]);
      if (order.error) throw order.error;
      return { order: order.data, catalog };
    },
  });
  const history = useQuery({
    queryKey: ["payment-history", id],
    queryFn: async () => {
      const r = await api.GET("/payments/{id}/history", {
        params: { path: { id } },
      });
      if (r.error) throw r.error;
      return r.data;
    },
    refetchInterval: live ? 2000 : false,
  });
  const mutation = useMutation({
    mutationFn: async (status: string) => {
      const r = await api.PATCH("/payments/{id}/status", {
        params: { path: { id } },
        body: { status },
      });
      if (r.error) throw r.error;
      return r.data;
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["payment", id] });
      void client.invalidateQueries({ queryKey: ["payment-history", id] });
      void client.invalidateQueries({ queryKey: ["payments"] });
    },
  });
  if (payment.isLoading) return <p role="status">Loading payment…</p>;
  if (!payment.data)
    return (
      <ErrorState
        message="Unable to load payment."
        retry={() => void payment.refetch()}
      />
    );
  const p = payment.data;
  const reached = new Set([
    p.status,
    ...(history.data ?? []).map((entry) => entry.status),
  ]);
  const outcome =
    p.status === "FAILED"
      ? "FAILED"
      : live
        ? "COMPLETED_OR_FAILED"
        : "COMPLETED";
  const steps = [
    "PENDING",
    "PROCESSING",
    outcome,
    ...(p.status === "REFUNDED" || reached.has("REFUNDED") ? ["REFUNDED"] : []),
  ];
  return (
    <>
      <Link to="/admin/payments" className="text-sm text-primary">
        ← Payments
      </Link>
      <div className="mt-4">
        <PageHeader
          title="Payment detail"
          description={`Payment ${p.id.slice(0, 8)}`}
          action={
            <span aria-live="polite">
              {live && (
                <span className="mr-3 text-sm text-primary">● Live</span>
              )}
              <StatusBadge status={p.status} />
            </span>
          }
        />
      </div>
      {payment.isError && (
        <ErrorState
          message="Live updates failed; the displayed status may be stale."
          retry={() => void payment.refetch()}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="border-t border-border bg-background p-6 lg:col-span-2">
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="mt-2 text-3xl font-semibold">
            <Money amount={p.amount} currency={p.currency} />
          </p>
          <ol
            aria-label="Payment progress"
            className="mt-5 flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm"
          >
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                {index > 0 && <span aria-hidden="true">→</span>}
                <span
                  className={
                    reached.has(step)
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }
                  aria-current={step === p.status ? "step" : undefined}
                >
                  {step === "COMPLETED_OR_FAILED" ? (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      Completed / Failed
                    </span>
                  ) : (
                    <StatusBadge status={step} />
                  )}
                  <span className="ml-1 text-xs">
                    {step === p.status
                      ? "Current"
                      : reached.has(step)
                        ? "Reached"
                        : history.isLoading
                          ? "Checking history"
                          : history.isError
                            ? "History unavailable"
                            : "Not recorded"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            {(transitions[p.status] ?? []).map((status) => (
              <Button
                key={status}
                disabled={mutation.isPending || payment.isError}
                onClick={() =>
                  status === "FAILED" || status === "REFUNDED"
                    ? setTarget(status)
                    : mutation.mutate(status)
                }
              >
                {status === "REFUNDED"
                  ? "Refund"
                  : `Mark ${status.toLowerCase()}`}
              </Button>
            ))}
          </div>
          {mutation.isError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Could not update the payment. Current state was refreshed.
            </p>
          )}
          <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Method</dt>
              <dd>
                <PaymentMethod method={p.method} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Order</dt>
              <dd>
                <Link
                  className="text-primary"
                  to={`/admin/orders/${p.orderId}`}
                >
                  View order
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>
                <RelativeTime value={p.createdAt} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>
                <RelativeTime value={p.updatedAt} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payment ID</dt>
              <dd className="flex items-center gap-1">
                <span>{p.id.slice(0, 8)}</span>
                <CopyButton value={p.id} />
              </dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="font-semibold">Order summary</h2>
            {orderSummary.isLoading ? (
              <p role="status" className="mt-3 text-sm">
                Loading order…
              </p>
            ) : orderSummary.isError || !orderSummary.data ? (
              <ErrorState
                message="Unable to load order details."
                retry={() => void orderSummary.refetch()}
              />
            ) : (
              <>
                <p className="mt-3 text-sm">
                  <Link
                    className="text-primary hover:underline"
                    to={`/admin/orders/${p.orderId}`}
                  >
                    {orderSummary.data.order.orderCode}
                  </Link>{" "}
                  ·{" "}
                  <Link
                    className="text-primary hover:underline"
                    to={`/admin/customers/${orderSummary.data.order.customerId}`}
                  >
                    {orderSummary.data.order.customerName}
                  </Link>
                </p>
                <ul className="mt-3 divide-y divide-border">
                  {orderSummary.data.order.items.map((item, index) => (
                    <li
                      className="flex justify-between gap-3 py-2 text-sm"
                      key={`${item.productId}-${index}`}
                    >
                      <span>
                        {orderSummary.data.catalog.find(
                          (product) => product.id === item.productId,
                        )?.productName ?? "Unavailable product"}{" "}
                        · Qty {item.quantity}
                      </span>
                      <Money amount={item.price} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
        <section className="border-t border-border bg-background p-6">
          <h2 className="font-semibold">Status timeline</h2>
          {history.isLoading ? (
            <p role="status" className="mt-4">
              Loading history…
            </p>
          ) : history.isError ? (
            <ErrorState retry={() => void history.refetch()} />
          ) : !history.data?.length ? (
            <div className="mt-4">
              <EmptyState title="No history yet" />
            </div>
          ) : (
            <ol className="mt-4 space-y-4 border-l border-border pl-4">
              {history.data.map((h, i) => (
                <li key={`${h.changedAt}-${i}`}>
                  <StatusBadge status={h.status} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    <RelativeTime value={h.changedAt} /> ·{" "}
                    {humanLabel(h.source)}
                  </p>
                  {h.note && <p className="text-sm">{h.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(v) => {
          if (!v) setTarget("");
        }}
        title={
          target === "REFUNDED" ? "Refund payment?" : "Mark payment failed?"
        }
        description="This changes the payment status."
        onConfirm={() => mutation.mutate(target)}
      />
    </>
  );
}
