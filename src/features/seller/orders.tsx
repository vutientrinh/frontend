import type { ColumnDef } from "@tanstack/react-table";
import { CircleX, Eye } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { DropdownMenu } from "../../components/DropdownMenu";
import { PageHeader } from "../../components/layout/Page";
import { QueueTabs } from "../../components/QueueTabs";
import {
  EmptyState,
  ErrorState,
  MoneyText,
  RelativeTime,
  StatusBadge,
} from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { useSellerOrderAction, useSellerOrders } from "../commerce/api";
import type {
  SellerOrderDetail,
  SellerOrderStatus,
  SellerOrderTab,
} from "../commerce/types";
import { ErrorText, OrderDeadline } from "./common";
import { RejectOrderDialog } from "./RejectOrderDialog";
import { COUNT_PAGE_SIZE, countsIfComplete } from "./seller-utils";

const TABS: [SellerOrderTab, string, SellerOrderStatus[]][] = [
  ["TO_CONFIRM", "To confirm", ["PAID"]],
  ["TO_PACK", "To pack", ["CONFIRMED"]],
  ["READY_TO_SHIP", "Ready to ship", ["PACKED"]],
  ["SHIPPING", "Shipping", ["SHIPPED"]],
  ["DELIVERED", "Delivered", ["DELIVERED", "COMPLETED"]],
  ["CANCELLED", "Cancelled", ["CANCELLED"]],
  ["RETURNS", "Returns", ["RETURN_REQUESTED", "RETURNED", "REFUNDED"]],
];

/** The one next step the seller can take from each status. */
const NEXT_STEP: Partial<
  Record<
    SellerOrderStatus,
    { action: "confirm" | "pack" | "handover"; label: string }
  >
> = {
  PAID: { action: "confirm", label: "Confirm" },
  CONFIRMED: { action: "pack", label: "Pack" },
  PACKED: { action: "handover", label: "Hand over" },
};

type Row = SellerOrderDetail & { selected: boolean };

interface RowActions {
  busy: boolean;
  advance: (id: string, action: "confirm" | "pack" | "handover") => void;
  askReject: (order: SellerOrderDetail) => void;
  select: (id: string, selected: boolean) => void;
}
// Cells read actions from context so the column lists stay constant (no cell remounts).
const RowActionsContext = createContext<RowActions | null>(null);

function SelectCell({ order }: { order: Row }) {
  const actions = useContext(RowActionsContext)!;
  return (
    <Checkbox
      className="min-w-11"
      aria-label={`Select ${order.orderNumber}`}
      checked={order.selected}
      onChange={(e) => actions.select(order.id, e.target.checked)}
    />
  );
}

function OrderActions({ order }: { order: Row }) {
  const actions = useContext(RowActionsContext)!;
  const navigate = useNavigate();
  const next = NEXT_STEP[order.status];
  return (
    <div className="flex items-center justify-end gap-2">
      {next && (
        <Button
          variant="secondary"
          className="min-h-11 whitespace-nowrap"
          disabled={actions.busy}
          aria-label={`${next.label} ${order.orderNumber}`}
          onClick={() => actions.advance(order.id, next.action)}
        >
          {next.label}
        </Button>
      )}
      <DropdownMenu
        label={`More actions for ${order.orderNumber}`}
        items={[
          {
            label: "View order",
            icon: Eye,
            onSelect: () => navigate(`/seller/orders/${order.id}`),
          },
          ...(order.status === "PAID"
            ? [
                {
                  label: "Reject order",
                  icon: CircleX,
                  destructive: true,
                  disabled: actions.busy,
                  onSelect: () => actions.askReject(order),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

const selectColumn: ColumnDef<Row> = {
  id: "Select",
  header: "Select",
  enableSorting: false,
  enableHiding: false,
  cell: ({ row }) => <SelectCell order={row.original} />,
};
const deadlineColumn: ColumnDef<Row> = {
  id: "Deadline",
  header: "Deadline",
  enableSorting: false,
  cell: ({ row }) => <OrderDeadline createdAt={row.original.createdAt} />,
};
const orderColumns: ColumnDef<Row>[] = [
  {
    id: "Order",
    header: "Order",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row: { original: o } }) => (
      <Link
        className="inline-flex min-h-11 items-center whitespace-nowrap font-mono text-caption text-primary underline"
        to={`/seller/orders/${o.id}`}
      >
        {o.orderNumber}
      </Link>
    ),
  },
  {
    id: "Created",
    header: "Created",
    enableSorting: false,
    cell: ({ row }) => <RelativeTime value={row.original.createdAt} />,
  },
  {
    id: "Status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "Total",
    header: "Total",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row }) => <MoneyText amount={row.original.total} size="small" />,
  },
];
const actionsColumn: ColumnDef<Row> = {
  id: "Actions",
  header: () => <span className="block text-right">Actions</span>,
  enableSorting: false,
  enableHiding: false,
  cell: ({ row }) => <OrderActions order={row.original} />,
};
const confirmColumns = [
  selectColumn,
  ...orderColumns,
  deadlineColumn,
  actionsColumn,
];
const plainColumns = [...orderColumns, actionsColumn];

export function Orders() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "TO_CONFIRM") as SellerOrderTab;
  const q = useSellerOrders({ status, page: params.get("page") ?? undefined });
  const everything = useSellerOrders({ size: COUNT_PAGE_SIZE });
  const counted = countsIfComplete(everything.data);
  const action = useSellerOrderAction();
  const [rejecting, setRejecting] = useState<SellerOrderDetail>();
  const selected = params.getAll("selected");
  const setSelected = (values: string[]) => {
    const next = new URLSearchParams(params);
    next.delete("selected");
    values.forEach((value) => next.append("selected", value));
    setParams(next, { replace: true });
  };
  const bulk = async () => {
    let remaining = [...selected];
    try {
      for (const id of selected) {
        await action.mutateAsync({ id, action: "confirm" });
        remaining = remaining.filter((value) => value !== id);
      }
      setSelected([]);
    } catch {
      // Preserve only unconfirmed orders so retry can continue after partial success.
      setSelected(remaining);
    }
  };
  const toConfirm = status === "TO_CONFIRM";
  const pageIds = q.data?.content.map((o) => o.id) ?? [];
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const queue = TABS.find(([key]) => key === status)?.[1].toLowerCase();
  return (
    <>
      <PageHeader
        title="Orders"
        description="Confirm paid orders within 24 hours, then pack and hand them over."
      />
      <div className="space-y-4">
        <QueueTabs
          label="Order status"
          noun="order"
          activeKey={status}
          tabs={TABS.map(([key, label, statuses]) => ({
            key,
            label,
            count: counted?.filter((o) => statuses.includes(o.status)).length,
            to: { search: `status=${key}` },
          }))}
        />
        {q.isError ? (
          <ErrorState retry={() => void q.refetch()} />
        ) : !q.data ? (
          <TableSkeleton columns={6} label="Loading orders" />
        ) : q.data.totalElements === 0 ? (
          <EmptyState
            title={`No orders in the ${queue ?? "selected"} queue.`}
            illustration="empty-queue"
          />
        ) : (
          <>
            {toConfirm && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox
                  label="Select all on this page"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? pageIds : [])}
                />
                <Button
                  className="min-h-11"
                  disabled={!selected.length || action.isPending}
                  onClick={() => void bulk()}
                >
                  Confirm selected ({selected.length})
                </Button>
              </div>
            )}
            <RowActionsContext.Provider
              value={{
                busy: action.isPending,
                advance: (id, next) => action.mutate({ id, action: next }),
                askReject: setRejecting,
                select: (id, on) =>
                  setSelected(
                    on
                      ? [...selected, id]
                      : selected.filter((value) => value !== id),
                  ),
              }}
            >
              <DataTable<Row>
                data={q.data.content.map((o) => ({
                  ...o,
                  selected: selected.includes(o.id),
                }))}
                columns={toConfirm ? confirmColumns : plainColumns}
                total={q.data.totalElements}
                onRetry={() => void q.refetch()}
                searchable={false}
              />
            </RowActionsContext.Provider>
          </>
        )}
        <ErrorText error={action.error} />
      </div>
      <RejectOrderDialog
        order={rejecting}
        onClose={() => setRejecting(undefined)}
        onReject={(id, reason) => {
          action.mutate(
            { id, action: "reject", reason },
            {
              onSuccess: () =>
                setSelected(selected.filter((value) => value !== id)),
            },
          );
        }}
      />
    </>
  );
}
