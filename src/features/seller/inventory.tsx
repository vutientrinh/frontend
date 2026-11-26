import type { ColumnDef } from "@tanstack/react-table";
import { createContext, useContext, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/layout/Page";
import { QueueTabs } from "../../components/QueueTabs";
import {
  EmptyState,
  ErrorState,
  FormField,
  RelativeTime,
} from "../../components/shared";
import { SideSheet } from "../../components/SideSheet";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  useAdjustInventory,
  useInventory,
  useInventoryMovements,
} from "../commerce/api";
import type { InventoryRow } from "../commerce/types";
import { ErrorText, NoResults, SearchField, StockBadge } from "./common";
import { LOW_STOCK_MAX, LOW_STOCK_RULE } from "./seller-utils";

const PAGE_SIZE = 20;

const OpenAdjustContext = createContext<(variantId: string) => void>(() => {});

function AdjustButton({ row }: { row: InventoryRow }) {
  const open = useContext(OpenAdjustContext);
  return (
    <div className="flex justify-end">
      <Button
        variant="secondary"
        className="min-h-11"
        aria-label={`Adjust stock for ${row.sku}`}
        onClick={() => open(row.variantId)}
      >
        Adjust
      </Button>
    </div>
  );
}

const columns: ColumnDef<InventoryRow>[] = [
  {
    id: "SKU",
    header: "SKU",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-mono text-caption">
        {row.original.sku}
      </span>
    ),
  },
  {
    id: "Product",
    header: "Product",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row: { original: r } }) => (
      <>
        <p className="font-medium">{r.productName}</p>
        {r.variantLabel && (
          <p className="text-xs text-muted-foreground">{r.variantLabel}</p>
        )}
      </>
    ),
  },
  {
    id: "On hand",
    header: "On hand",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row }) => row.original.onHand,
  },
  {
    id: "Reserved",
    header: "Reserved",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row }) => row.original.reserved,
  },
  {
    id: "Available",
    header: "Available",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row: { original: r } }) => (
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold">{r.available}</span>
        <StockBadge units={r.available} />
      </div>
    ),
  },
  {
    id: "Actions",
    header: () => <span className="block text-right">Actions</span>,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <AdjustButton row={row.original} />,
  },
];

/** Body of the side sheet; keyed by variant so form and request state reset per row. */
function AdjustStock({ row }: { row: InventoryRow }) {
  const adjust = useAdjustInventory();
  const moves = useInventoryMovements(row.variantId);
  const onAdjust = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    adjust.mutate(
      {
        id: row.variantId,
        delta: Number(data.get("delta")),
        reason: String(data.get("reason")),
      },
      { onSuccess: () => form.reset() },
    );
  };
  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm">
        Available now
        <strong className="tabular-nums">{row.available}</strong>
        <StockBadge units={row.available} />
      </p>
      <form onSubmit={onAdjust} className="grid gap-4">
        <FormField
          id="adjust-delta"
          label="Change in units"
          required
          hint="Use a negative number to remove stock."
        >
          <Input name="delta" type="number" required className="min-h-11" />
        </FormField>
        <FormField id="adjust-reason" label="Reason" required>
          <Input name="reason" required className="min-h-11" />
        </FormField>
        <ErrorText error={adjust.error} />
        <Button type="submit" className="min-h-11" disabled={adjust.isPending}>
          Save adjustment
        </Button>
      </form>
      <section aria-labelledby="movements-title">
        <h3 id="movements-title" className="mb-2 font-semibold">
          Movements
        </h3>
        {moves.isError ? (
          <ErrorState retry={() => void moves.refetch()} />
        ) : !moves.data ? (
          <TableSkeleton rows={3} columns={2} label="Loading movements" />
        ) : moves.data.length ? (
          <ul className="divide-y divide-border">
            {moves.data.map((m) => (
              <li key={m.id} className="flex gap-3 py-2 text-sm">
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </span>
                <span className="min-w-0 flex-1">{m.reason}</span>
                <span className="text-muted-foreground">
                  <RelativeTime value={m.at} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No movements yet." illustration="empty-queue" />
        )}
      </section>
    </div>
  );
}

export function Inventory() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const lowOnly = params.get("lowStock") === "true";
  // The low-stock rule (G5) is applied here, so every row is requested.
  const q = useInventory({ q: search || undefined });
  const rows = q.data ?? [];
  const low = rows.filter((r) => r.available <= LOW_STOCK_MAX);
  const shown = lowOnly ? low : rows;
  const page = Math.max(0, Number(params.get("page")) || 0);
  // `selected` is the one param DataTable does not turn into a filter chip.
  const selected = rows.find((r) => r.variantId === params.get("selected"));
  const setSelected = (variantId: string) => {
    const next = new URLSearchParams(params);
    if (variantId) next.set("selected", variantId);
    else next.delete("selected");
    setParams(next, { replace: true });
  };
  const tab = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) next.set("lowStock", "true");
    else next.delete("lowStock");
    next.delete("page");
    return { search: next.toString() };
  };
  return (
    <>
      <PageHeader title="Inventory" description={LOW_STOCK_RULE} />
      <div className="space-y-4">
        <QueueTabs
          label="Stock level"
          noun="variant"
          activeKey={lowOnly ? "low" : "all"}
          tabs={[
            {
              key: "all",
              label: "All",
              count: q.data?.length,
              to: tab(false),
            },
            {
              key: "low",
              label: "Low stock",
              count: q.data ? low.length : undefined,
              to: tab(true),
            },
          ]}
        />
        <SearchField label="Search inventory" />
        {q.isError ? (
          <ErrorState retry={() => void q.refetch()} />
        ) : !q.data ? (
          <TableSkeleton columns={6} label="Loading inventory" />
        ) : shown.length === 0 ? (
          search || lowOnly ? (
            <NoResults keys={["q", "lowStock"]} />
          ) : (
            <EmptyState
              title="No inventory yet."
              description="Stock appears here once you add a product."
              illustration="empty-seller-products"
              action={
                <Button asChild variant="secondary">
                  <Link to="/seller/products/new">Add product</Link>
                </Button>
              }
            />
          )
        ) : (
          <OpenAdjustContext.Provider value={setSelected}>
            <DataTable
              data={shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
              columns={columns}
              total={shown.length}
              onRetry={() => void q.refetch()}
              searchable={false}
            />
          </OpenAdjustContext.Provider>
        )}
      </div>
      <SideSheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected("");
        }}
        title="Adjust stock"
        description={
          selected
            ? [selected.productName, selected.variantLabel, selected.sku]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      >
        {selected && <AdjustStock key={selected.variantId} row={selected} />}
      </SideSheet>
    </>
  );
}
