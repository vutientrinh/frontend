import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import {
  Money,
  PageHeader,
  PaymentMethod,
  RelativeTime,
  StatusBadge,
} from "../../../components/shared";
import { humanLabel } from "../../../lib/labels";
import { useAdminSellers, useMarketplaceOrders } from "../api";
import { FilterPills } from "../components";
import type { AdminSellerOrderRow } from "../types";

const STATUSES = [
  "",
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "REFUNDED",
].map((value) => ({ value, label: value ? humanLabel(value) : "All" }));

const FILTER_KEYS = [
  "status",
  "sellerSlug",
  "paymentMethod",
  "from",
  "to",
  "slaBreached",
] as const;

const columns: ColumnDef<AdminSellerOrderRow>[] = [
  {
    id: "orderNumber",
    header: "Order",
    accessorFn: (r) => r.orderNumber,
    cell: ({ row }) => (
      <span className="flex items-center gap-1 font-mono font-medium text-primary">
        {row.original.orderNumber}
        {row.original.slaBreached && (
          <TriangleAlert
            size={14}
            aria-label="Confirmation SLA breached"
            className="text-status-pending"
          />
        )}
      </span>
    ),
  },
  {
    id: "seller",
    header: "Seller",
    accessorFn: (r) => r.seller.name,
    enableSorting: false,
  },
  {
    id: "customer",
    header: "Customer",
    accessorFn: (r) => r.customer.name,
    enableSorting: false,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "paymentMethod",
    header: "Payment",
    accessorFn: (r) => r.paymentMethod,
    cell: ({ row }) => <PaymentMethod method={row.original.paymentMethod} />,
  },
  {
    id: "amount",
    header: "Total",
    accessorFn: (r) => r.total,
    enableSorting: false,
    cell: ({ row }) => <Money amount={row.original.total} />,
  },
  {
    id: "createdAt",
    header: "Created",
    accessorFn: (r) => r.createdAt,
    cell: ({ row }) => <RelativeTime value={row.original.createdAt} />,
  },
];

function useWide() {
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const change = () => setWide(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return wide;
}

/** A-14 Marketplace orders: filters in the URL, split view with J/K, Enter, Esc. */
export default function OrdersPage() {
  const wide = useWide();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const get = (key: string) => params.get(key) ?? "";
  const sellers = useAdminSellers({ size: 100 });
  const list = useMarketplaceOrders({
    ...Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k) || undefined])),
    q: get("q") || undefined,
    sort: get("sort") || undefined,
    page: Number(get("page")) || 0,
    size: 20,
  });
  const rows = useMemo(() => list.data?.content ?? [], [list.data]);
  const selectedId = get("selected");
  const selected = rows.find((r) => r.id === selectedId);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    next.delete("selected");
    setParams(next);
  };

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
      if (event.key === "Enter") {
        if (selected) navigate(`/admin/marketplace/orders/${selected.id}`);
        return;
      }
      const index = rows.findIndex((r) => r.id === selectedId);
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
  }, [wide, rows, selected, selectedId, params, setParams, navigate]);

  const select =
    "min-h-10 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <>
      <PageHeader
        title="Marketplace orders"
        description="Seller orders across all shops, with payment and SLA status."
      />
      <section className="space-y-3 border-t border-border pt-4">
        <FilterPills
          label="Order status"
          options={STATUSES}
          value={get("status")}
          onChange={(v) => update("status", v)}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-muted-foreground">Seller</span>
            <select
              className={select}
              value={get("sellerSlug")}
              onChange={(e) => update("sellerSlug", e.target.value)}
            >
              <option value="">All sellers</option>
              {(sellers.data?.content ?? []).map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Payment method</span>
            <select
              className={select}
              value={get("paymentMethod")}
              onChange={(e) => update("paymentMethod", e.target.value)}
            >
              <option value="">All methods</option>
              <option value="WALLET">Wallet</option>
              <option value="VIETQR">VietQR</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">From</span>
            <input
              type="date"
              className={select}
              value={get("from")}
              onChange={(e) => update("from", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">To</span>
            <input
              type="date"
              className={select}
              value={get("to")}
              onChange={(e) => update("to", e.target.value)}
            />
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={get("slaBreached") === "true"}
              onChange={(e) =>
                update("slaBreached", e.target.checked ? "true" : "")
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />
            SLA breached only
          </label>
        </div>
        <div
          className={
            wide && selected
              ? "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
              : ""
          }
        >
          <DataTable
            data={rows}
            columns={columns}
            total={list.data?.totalElements ?? 0}
            loading={list.isLoading}
            error={list.isError}
            onRetry={() => void list.refetch()}
            selectedId={selectedId}
            getRowId={(r) => r.id}
            onRowClick={(r) => {
              if (!wide) {
                navigate(`/admin/marketplace/orders/${r.id}`);
                return;
              }
              const next = new URLSearchParams(params);
              next.set("selected", r.id);
              setParams(next);
            }}
          />
          {wide && selected && (
            <aside
              aria-label="Selected order"
              className="h-fit border-l border-border pl-6"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Order details</h2>
                <button
                  type="button"
                  aria-label="Close details"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.delete("selected");
                    setParams(next);
                  }}
                  className="rounded-sm px-2 hover:bg-muted"
                >
                  ×
                </button>
              </div>
              <p className="mt-4 font-mono text-sm">{selected.orderNumber}</p>
              <p className="text-xs text-muted-foreground">
                Parent {selected.parentOrderNumber}
              </p>
              <p className="mt-3">
                <StatusBadge status={selected.status} />
              </p>
              <p className="mt-4 text-2xl font-semibold">
                <Money amount={selected.total} />
              </p>
              <dl className="mt-3 space-y-1 text-sm">
                <div>
                  <dt className="inline text-muted-foreground">Seller: </dt>
                  <dd className="inline">{selected.seller.name}</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Customer: </dt>
                  <dd className="inline">
                    {selected.customer.name} · {selected.customer.phone}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Payment: </dt>
                  <dd className="inline">
                    <PaymentMethod method={selected.paymentMethod} />
                  </dd>
                </div>
              </dl>
              {selected.slaBreached && (
                <p className="mt-3 flex items-center gap-1 text-sm text-status-pending">
                  <TriangleAlert size={14} aria-hidden="true" /> Seller has not
                  confirmed within 24 h
                </p>
              )}
              <Link
                className="mt-5 inline-block text-sm text-primary underline"
                to={`/admin/marketplace/orders/${selected.id}`}
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
