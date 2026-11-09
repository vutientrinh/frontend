import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import type { ProblemDetail } from "../../api/types";
import { orders } from "../transactions/lookups";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  PaymentMethod,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
export default function PaymentForm() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    client = useQueryClient(),
    [id, setId] = useState(params.get("orderId") ?? ""),
    [method, setMethod] = useState("CARD"),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [ambiguous, setAmbiguous] = useState(false);
  useEffect(() => {
    document.title = "Create payment | Payment Project";
  }, []);
  const query = useQuery({
    queryKey: ["eligible-orders"],
    queryFn: () => orders("PENDING"),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await api.POST("/payments", { body: { orderId: id, method } });
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: ["payments"] });
      void client.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/admin/payments/${data.id}`);
    },
    onError: (e) => {
      const p = e as ProblemDetail;
      setError(
        p.detail ??
          "The result is unknown. Check the payment list before attempting again.",
      );
      if (!p.status || p.status >= 500) setAmbiguous(true);
      void query.refetch();
    },
  });
  if (query.isLoading) return <p role="status">Loading eligible orders…</p>;
  if (query.isError || !query.data)
    return <ErrorState retry={() => void query.refetch()} />;
  if (!query.data.length)
    return (
      <EmptyState
        title="No eligible orders"
        description="Create a pending order before making a payment."
        action={
          <Link className="text-primary underline" to="/admin/orders/new">
            Create an order
          </Link>
        }
      />
    );
  const selected = query.data.find((o) => o.id === id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Select an eligible order.");
      return;
    }
    setError("");
    setConfirm(true);
  };
  return (
    <>
      <PageHeader
        title="Create payment"
        description="Choose a pending order and payment method."
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-5 border-t border-border bg-background p-6 lg:col-span-2">
          {error && (
            <p
              role="alert"
              className="rounded bg-muted p-3 text-sm text-destructive"
            >
              {error}{" "}
              {ambiguous && (
                <Link className="underline" to="/admin/payments">
                  View payments
                </Link>
              )}
            </p>
          )}
          <label className="block text-sm font-medium">
            Order
            <select
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-2"
            >
              <option value="">Select an order</option>
              {query.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderCode} · {o.customerName}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Payment method</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["CARD", "Card"],
                ["BANK_TRANSFER", "Bank transfer"],
                ["EWALLET", "E-wallet"],
              ].map(([value]) => (
                <label
                  key={value}
                  className={`rounded-lg border p-4 text-sm ${method === value ? "border-primary bg-muted" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="mr-2"
                  />
                  <PaymentMethod method={value} />
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        <aside className="h-fit border-t border-border bg-background p-6">
          <h2 className="font-semibold">Payment summary</h2>
          <p className="mt-4 text-sm">
            {selected?.orderCode ?? "No order selected"}
          </p>
          {selected && (
            <p className="mt-2 text-xl font-semibold">
              <Money amount={selected.orderAmount} />
            </p>
          )}
          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={mutation.isPending || ambiguous}
          >
            Review payment
          </Button>
        </aside>
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Create payment?"
        description="A payment will be created for this order."
        onConfirm={() => mutation.mutate()}
      />
    </>
  );
}
