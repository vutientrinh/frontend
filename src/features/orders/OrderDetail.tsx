import { humanLabel } from "../../lib/labels";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../api/client";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  RelativeTime,
  StatusBadge,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
import OrderForm from "./OrderForm";
import { products } from "../transactions/lookups";
export default function OrderDetail() {
  const { id = "" } = useParams(),
    navigate = useNavigate(),
    client = useQueryClient(),
    [params] = useSearchParams(),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    document.title = "Order detail | Payment Project";
  }, []);
  const order = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await api.GET("/orders/{id}", { params: { path: { id } } });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const pay = useQuery({
    queryKey: ["order-payments", id],
    queryFn: async () => {
      const r = await api.GET("/payments", {
        params: { query: { orderId: id, size: 1 } },
      });
      if (r.error) throw r.error;
      return r.data.content[0] ?? null;
    },
  });
  const productNames = useQuery({
    queryKey: ["order-product-names"],
    queryFn: products,
  });
  const remove = useMutation({
    mutationFn: async () => {
      const r = await api.DELETE("/orders/{id}", { params: { path: { id } } });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["orders"] });
      navigate("/admin/orders");
    },
    onError: () => {
      void pay.refetch();
      void order.refetch();
    },
  });
  if (order.isLoading || pay.isLoading)
    return <p role="status">Loading order…</p>;
  if (order.isError || pay.isError || !order.data)
    return (
      <ErrorState
        message="Unable to load the order or payment state."
        retry={() => {
          void order.refetch();
          void pay.refetch();
        }}
      />
    );
  const o = order.data,
    p = pay.data;
  if (params.get("edit") === "1" && !p) return <OrderForm existing={o} />;
  return (
    <>
      <Link to="/admin/orders" className="text-sm text-primary">
        ← Orders
      </Link>
      <div className="mt-4">
        <PageHeader
          title={o.orderCode}
          description="Order detail"
          action={
            <div className="flex gap-2">
              <Button disabled={!!p} asChild={!p}>
                {p ? <span>Edit</span> : <Link to={`?edit=1`}>Edit</Link>}
              </Button>
              <Button
                disabled={!!p || remove.isPending}
                onClick={() => setConfirm(true)}
              >
                Delete
              </Button>
            </div>
          }
        />
      </div>
      {p && (
        <p className="mb-4 rounded bg-muted p-3 text-sm">
          This order is locked because a payment exists.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="border-t border-border bg-background p-6 lg:col-span-2">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Order amount</p>
              <p className="mt-2 text-3xl font-semibold">
                <Money amount={o.orderAmount} />
              </p>
              <h2 className="mt-6 font-semibold">Items</h2>
            </div>
            <StatusBadge status={o.status} />
          </div>
          {o.items.length === 0 ? (
            <EmptyState title="No items" />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {o.items.map((i, index) => (
                <li
                  key={`${i.productId}-${index}`}
                  className="flex justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    {productNames.data?.find((p) => p.id === i.productId)
                      ?.productName ?? "Unavailable product"}{" "}
                    · Qty {i.quantity}
                  </span>
                  <Money amount={i.price} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex justify-between font-semibold">
            <span>Total</span>
            <Money amount={o.orderAmount} />
          </p>
        </section>
        <aside className="space-y-6">
          <section className="border-t border-border pt-6">
            <h2 className="font-semibold">Activity</h2>
            <p className="mt-3 text-sm">
              Order created · <RelativeTime value={o.createdAt} />
            </p>
            <p className="mt-2">
              <StatusBadge status={o.status} />
            </p>
          </section>
          <section className="border-t border-border bg-background p-6">
            <h2 className="font-semibold">Customer</h2>
            <Link
              className="mt-3 block text-primary"
              to={`/admin/customers/${o.customerId}`}
            >
              {o.customerName}
            </Link>
          </section>
          <section className="border-t border-border bg-background p-6">
            <h2 className="font-semibold">Payment</h2>
            {p ? (
              <Link
                className="mt-3 block text-primary"
                to={`/admin/payments/${p.id}`}
              >
                View payment · {humanLabel(p.status)}
              </Link>
            ) : o.status === "PENDING" ? (
              <Button asChild className="mt-4">
                <Link
                  to={`/admin/payments/new?orderId=${encodeURIComponent(o.id)}`}
                >
                  Pay now
                </Link>
              </Button>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No payment available.
              </p>
            )}
          </section>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete order?"
        description="This removes the order from the demo."
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
