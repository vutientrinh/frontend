import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Big from "big.js";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import type { Order, ProblemDetail } from "../../api/types";
import { customers, products } from "../transactions/lookups";
import {
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
import { SearchCombobox } from "../../components/SearchCombobox";
type Row = { productId: string; quantity: string };
export default function OrderForm({ existing }: { existing?: Order }) {
  const navigate = useNavigate(),
    client = useQueryClient();
  const [code, setCode] = useState(
      () => existing?.orderCode ?? `ORD-${Date.now().toString().slice(-7)}`,
    ),
    [customerId, setCustomerId] = useState(existing?.customerId ?? ""),
    [rows, setRows] = useState<Row[]>(
      existing?.items.map((i) => ({
        productId: i.productId,
        quantity: String(i.quantity),
      })) ?? [{ productId: "", quantity: "1" }],
    ),
    [error, setError] = useState("");
  useEffect(() => {
    document.title = `${existing ? "Edit" : "Create"} order | Payment Project`;
  }, [existing]);
  const lookup = useQuery({
    queryKey: ["order-choices"],
    queryFn: async () => {
      const [c, p] = await Promise.all([customers(), products()]);
      return { customers: c, products: p };
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        orderCode: code.trim(),
        customerId,
        items: rows.map((r) => ({
          productId: r.productId,
          quantity: parseInt(r.quantity, 10),
        })),
      };
      const result = existing
        ? await api.PUT("/orders/{id}", {
            params: { path: { id: existing.id } },
            body,
          })
        : await api.POST("/orders", { body });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/admin/orders/${data.id}`);
    },
    onError: (e) => {
      const p = e as ProblemDetail;
      setError(p.detail ?? "Could not save order. Please try again.");
    },
  });
  if (lookup.isLoading) return <p role="status">Loading order choices…</p>;
  if (lookup.isError || !lookup.data)
    return <ErrorState retry={() => void lookup.refetch()} />;
  if (!lookup.data.customers.length || !lookup.data.products.length)
    return (
      <EmptyState
        title="More details needed"
        description="Add a customer and an active product before creating an order."
        action={
          <Link className="text-primary underline" to="/admin/customers">
            View customers
          </Link>
        }
      />
    );
  const total = rows.reduce((sum, row) => {
    const p = lookup.data.products.find((x) => x.id === row.productId);
    return p && /^\d+$/.test(row.quantity)
      ? sum.plus(new Big(p.unitPrice).times(row.quantity))
      : sum;
  }, new Big(0));
  const change = (index: number, part: Partial<Row>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...part } : row)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      !code.trim() ||
      !customerId ||
      rows.some(
        (r) =>
          !lookup.data.products.some((p) => p.id === r.productId) ||
          !/^\d+$/.test(r.quantity) ||
          !Number.isSafeInteger(Number(r.quantity)) ||
          Number(r.quantity) < 1,
      )
    ) {
      setError(
        "Enter an order code, customer, active products and positive whole quantities.",
      );
      return;
    }
    setError("");
    mutation.mutate();
  };
  return (
    <>
      <PageHeader
        title={existing ? "Edit order" : "Create order"}
        description="Select a customer and add items. Prices are estimates until saved."
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 border-t border-border bg-background p-6">
            <h2 className="font-semibold">Order details</h2>
            {error && (
              <p
                role="alert"
                className="rounded bg-muted p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <label className="block text-sm font-medium">
              Order code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background p-2"
              />
            </label>
            <div className="block text-sm font-medium">
              Customer
              <SearchCombobox
                label="Customer"
                value={customerId}
                onChange={setCustomerId}
                options={lookup.data.customers.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName} · ${c.email}`,
                }))}
              />
            </div>
          </section>
          <section className="space-y-4 border-t border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Items</h2>
              <button
                type="button"
                onClick={() =>
                  setRows([...rows, { productId: "", quantity: "1" }])
                }
                className="flex items-center gap-1 text-sm text-primary"
              >
                <Plus size={16} />
                Add item
              </button>
            </div>
            {rows.map((row, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1 text-sm">
                  Product {index + 1}
                  <SearchCombobox
                    label={`Product ${index + 1}`}
                    value={row.productId}
                    onChange={(value) => change(index, { productId: value })}
                    options={lookup.data.products.map((p) => ({
                      value: p.id,
                      label: p.productName,
                    }))}
                  />
                </div>
                <label className="w-24 text-sm">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) =>
                      change(index, { quantity: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-border bg-background p-2"
                  />
                </label>
                {lookup.data.products.find((p) => p.id === row.productId) &&
                  /^\d+$/.test(row.quantity) && (
                    <p className="pb-2 text-sm">
                      Unit:{" "}
                      <Money
                        amount={
                          lookup.data.products.find(
                            (p) => p.id === row.productId,
                          )!.unitPrice
                        }
                      />{" "}
                      · Total:{" "}
                      <Money
                        amount={new Big(
                          lookup.data.products.find(
                            (p) => p.id === row.productId,
                          )!.unitPrice,
                        )
                          .times(row.quantity)
                          .toFixed()}
                      />
                    </p>
                  )}
                <button
                  type="button"
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  aria-label={`Remove item ${index + 1}`}
                  className="rounded p-2 hover:bg-muted disabled:opacity-40"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </section>
        </div>
        <aside className="h-fit border-t border-border bg-background p-6">
          <h2 className="font-semibold">Summary</h2>
          <p className="mt-4 flex justify-between text-sm">
            <span>Estimated total</span>
            <strong>
              <Money amount={total.toFixed()} />
            </strong>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The server calculates the final total.
          </p>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="mt-6 w-full"
          >
            {mutation.isPending
              ? "Saving…"
              : existing
                ? "Save order"
                : "Create order"}
          </Button>
          <Link
            to={existing ? `/admin/orders/${existing.id}` : "/admin/orders"}
            className="mt-4 block text-center text-sm text-muted-foreground"
          >
            Cancel
          </Link>
        </aside>
      </form>
    </>
  );
}
