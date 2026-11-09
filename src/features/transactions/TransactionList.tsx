import { humanLabel } from "../../lib/labels";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import type { Order, Payment } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import {
  Money,
  PageHeader,
  RelativeTime,
  StatusBadge,
  PaymentMethod,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
export default function TransactionList({
  kind,
}: {
  kind: "orders" | "payments";
}) {
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const change = () => setWide(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const order = kind === "orders",
    title = order ? "Orders" : "Payments",
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  useEffect(() => {
    document.title = `${title} | Payment Project`;
  }, [title]);
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10) || 0),
    status = params.get("status") ?? "",
    method = params.get("method") ?? "",
    q = params.get("q") ?? "",
    sort = params.get("sort") ?? "";
  const query = useQuery({
    queryKey: [kind, { page, status, method, q, sort }],
    queryFn: async () => {
      const options = {
        params: {
          query: {
            page,
            size: 20,
            ...(status ? { status } : {}),
            ...(q && order ? { q } : {}),
            ...(method ? { method } : {}),
            ...(sort ? { sort } : {}),
          },
        },
      };
      const r = order
        ? await api.GET("/orders", options)
        : await api.GET("/payments", options);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const selectedId = params.get("selected") ?? "";
  const rows = useMemo(
    () => (query.data?.content ?? []) as (Order | Payment)[],
    [query.data],
  );
  const selected = rows.find((row) => row.id === selectedId);
  useEffect(() => {
    if (!wide) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (event.key === "Escape" && selectedId) {
        const next = new URLSearchParams(params);
        next.delete("selected");
        setParams(next);
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select,button,a") ||
          event.target.isContentEditable)
      )
        return;
      if (!rows.length || !["j", "k", "Enter"].includes(event.key)) return;
      if (event.key === "Enter" && selected) {
        navigate(`/admin/${kind}/${selected.id}`);
        return;
      }
      if (event.key === "Enter") return;
      const index = rows.findIndex((row) => row.id === selectedId);
      const nextIndex =
        index < 0
          ? event.key === "j"
            ? 0
            : rows.length - 1
          : Math.max(
              0,
              Math.min(rows.length - 1, index + (event.key === "j" ? 1 : -1)),
            );
      const next = new URLSearchParams(params);
      next.set("selected", rows[nextIndex].id);
      setParams(next, { replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, rows, selected, selectedId, params, setParams, navigate, kind]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    next.delete("selected");
    setParams(next);
  };
  const columns: ColumnDef<Order | Payment>[] = [
    {
      id: order ? "orderCode" : "id",
      header: order ? "Order" : "Payment",
      accessorFn: (r) => ("orderCode" in r ? r.orderCode : r.id),
      cell: ({ row }) => (
        <span
          className="block max-w-36 truncate font-mono font-medium text-primary"
          title={
            "orderCode" in row.original
              ? row.original.orderCode
              : row.original.id
          }
        >
          {"orderCode" in row.original
            ? row.original.orderCode
            : row.original.id.slice(0, 12)}
        </span>
      ),
    },
    ...(order
      ? [
          {
            id: "customerName",
            header: "Customer",
            accessorFn: (r: Order | Payment) =>
              "customerName" in r ? r.customerName : "",
          },
        ]
      : [
          {
            id: "method",
            header: "Method",
            accessorFn: (r: Order | Payment) => ("method" in r ? r.method : ""),
            cell: ({ row }: { row: { original: Order | Payment } }) => (
              <PaymentMethod
                method={"method" in row.original ? row.original.method : ""}
              />
            ),
          },
        ]),
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.status,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: order ? "orderAmount" : "amount",
      header: "Amount",
      accessorFn: (r) => ("orderAmount" in r ? r.orderAmount : r.amount),
      cell: ({ row }) => (
        <Money
          amount={
            "orderAmount" in row.original
              ? row.original.orderAmount
              : row.original.amount
          }
        />
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      accessorFn: (r) => r.createdAt,
      cell: ({ row }) => <RelativeTime value={row.original.createdAt} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          className="text-primary underline"
          onClick={(event) => event.stopPropagation()}
          to={`/admin/${kind}/${row.original.id}`}
          aria-label={`Open ${order ? "order" : "payment"} details`}
        >
          Open
        </Link>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title={title}
        description={
          order
            ? "Track orders and their payment progress."
            : "Monitor payment activity and status."
        }
        action={
          <Button asChild>
            <Link to={`/admin/${kind}/new`}>
              <Plus size={16} className="mr-2" />
              New {order ? "order" : "payment"}
            </Link>
          </Button>
        }
      />
      <section className="border-t border-border pt-4">
        <div
          className="sticky top-0 z-20 mb-5 flex flex-wrap gap-2 bg-background py-2"
          aria-label="Status filters"
        >
          {(order
            ? [
                "",
                "PENDING",
                "PAYMENT_PROCESSING",
                "PAID",
                "PAYMENT_FAILED",
                "REFUNDED",
              ]
            : ["", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED"]
          ).map((s) => (
            <button
              key={s}
              onClick={() => update("status", s)}
              aria-pressed={status === s}
              className={`rounded-md px-3 py-2 text-sm ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {s ? humanLabel(s) : "All"}
            </button>
          ))}
        </div>
        {!order && (
          <label className="mb-4 inline-flex items-center gap-2 text-sm">
            Method
            <select
              value={method}
              onChange={(e) => update("method", e.target.value)}
              className="rounded border border-border bg-background p-2"
            >
              <option value="">All methods</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="EWALLET">E-wallet</option>
            </select>
          </label>
        )}
        <div
          className={
            wide && selected
              ? "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"
              : ""
          }
        >
          <DataTable
            searchable={order}
            data={rows}
            columns={columns}
            total={query.data?.totalElements ?? 0}
            loading={query.isLoading}
            error={query.isError}
            onRetry={() => void query.refetch()}
            selectedId={selectedId}
            getRowId={(row) => row.id}
            onRowClick={(row) => {
              if (!wide) {
                navigate(`/admin/${kind}/${row.id}`);
                return;
              }
              const next = new URLSearchParams(params);
              next.set("selected", row.id);
              setParams(next);
            }}
          />
          {wide && selected && (
            <aside
              aria-label={`Selected ${order ? "order" : "payment"}`}
              className="h-fit border-l border-border pl-6"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {order ? "Order" : "Payment"} details
                </h2>
                <button
                  aria-label="Close details"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.delete("selected");
                    setParams(next);
                  }}
                >
                  ×
                </button>
              </div>
              <p
                className="mt-4 truncate font-mono text-sm"
                title={selected.id}
              >
                {"orderCode" in selected ? selected.orderCode : selected.id}
              </p>
              <p className="mt-3">
                <StatusBadge status={selected.status} />
              </p>
              <p className="mt-4 text-2xl font-semibold">
                <Money
                  amount={
                    "orderAmount" in selected
                      ? selected.orderAmount
                      : selected.amount
                  }
                />
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {"customerName" in selected ? (
                  selected.customerName
                ) : (
                  <PaymentMethod method={selected.method} />
                )}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <RelativeTime value={selected.createdAt} />
              </p>
              <Link
                className="mt-5 inline-block text-sm text-primary underline"
                to={`/admin/${kind}/${selected.id}`}
              >
                Open full details
              </Link>
              <p className="mt-4 text-xs text-muted-foreground">
                J / K to move · Enter to open · Esc to close
              </p>
            </aside>
          )}
        </div>
      </section>
    </>
  );
}
