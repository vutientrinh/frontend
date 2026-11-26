import type { ColumnDef } from "@tanstack/react-table";
import { Copy, ExternalLink, Eye, EyeOff } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { DropdownMenu } from "../../components/DropdownMenu";
import { PageHeader } from "../../components/layout/Page";
import { ProductThumb } from "../../components/ProductThumb";
import { QueueTabs } from "../../components/QueueTabs";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  MoneyText,
  StatusBadge,
} from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import {
  useDuplicateSellerProduct,
  useSellerProductAction,
  useSellerProducts,
} from "../commerce/api";
import type { SellerProduct } from "../commerce/types";
import { ErrorText, NoResults, SearchField, StockBadge } from "./common";
import {
  COUNT_PAGE_SIZE,
  countsIfComplete,
  LOW_STOCK_RULE,
} from "./seller-utils";

const STATUS_TABS = [
  ["", "All"],
  ["LIVE", "Live"],
  ["DRAFT", "Draft"],
  ["PENDING_REVIEW", "Pending review"],
  ["REJECTED", "Rejected"],
  ["HIDDEN", "Hidden"],
] as const;

interface RowActions {
  duplicating: boolean;
  duplicate: (product: SellerProduct) => void;
  askHide: (product: SellerProduct) => void;
  unhide: (product: SellerProduct) => void;
}
// Cells read actions from context so the column list stays constant (no cell remounts).
const RowActionsContext = createContext<RowActions | null>(null);

function ProductActions({ product }: { product: SellerProduct }) {
  const actions = useContext(RowActionsContext)!;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button asChild variant="secondary" className="min-h-11">
        <Link
          to={`/seller/products/${product.id}`}
          aria-label={`Edit ${product.name}`}
        >
          Edit
        </Link>
      </Button>
      <DropdownMenu
        label={`More actions for ${product.name}`}
        items={[
          {
            label: "Duplicate",
            icon: Copy,
            disabled: actions.duplicating,
            onSelect: () => actions.duplicate(product),
          },
          ...(product.status === "LIVE"
            ? [
                {
                  label: "View on storefront",
                  icon: ExternalLink,
                  to: `/p/${product.slug}`,
                },
                {
                  label: "Hide",
                  icon: EyeOff,
                  destructive: true,
                  onSelect: () => actions.askHide(product),
                },
              ]
            : []),
          ...(product.status === "HIDDEN"
            ? [
                {
                  label: "Unhide",
                  icon: Eye,
                  onSelect: () => actions.unhide(product),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

const columns: ColumnDef<SellerProduct>[] = [
  {
    id: "Product",
    header: "Product",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row: { original: p } }) => (
      <div className="flex items-center gap-3">
        <ProductThumb src={p.imageUrl} size={56} soldOut={p.totalStock <= 0} />
        <div className="min-w-0">
          <Link
            className="flex min-h-11 items-center font-medium hover:underline"
            to={`/seller/products/${p.id}`}
          >
            <span className="line-clamp-2">{p.name}</span>
          </Link>
          <p className="text-xs text-muted-foreground">
            {p.variantCount} {p.variantCount === 1 ? "variant" : "variants"}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "Price",
    header: "Price",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row: { original: p } }) => (
      <>
        <MoneyText amount={p.price} size="small" />
        {p.compareAtPrice && (
          <s className="block text-xs text-muted-foreground">
            <span className="sr-only">Compare at </span>
            <MoneyText amount={p.compareAtPrice} tone="muted" />
          </s>
        )}
      </>
    ),
  },
  {
    id: "Stock",
    header: "Stock",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row: { original: p } }) => (
      <div className="flex flex-col items-end gap-1">
        <span>{p.totalStock}</span>
        <StockBadge units={p.totalStock} />
      </div>
    ),
  },
  {
    id: "Sales",
    header: "Sales",
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row }) => row.original.soldCount,
  },
  {
    id: "Status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "Actions",
    header: () => <span className="block text-right">Actions</span>,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <ProductActions product={row.original} />,
  },
];

export function Products() {
  const [params] = useSearchParams();
  const status = params.get("status") ?? "";
  const search = params.get("q") ?? "";
  const q = useSellerProducts({
    q: search || undefined,
    status: status || undefined,
    page: params.get("page") ?? undefined,
  });
  const everything = useSellerProducts({ size: COUNT_PAGE_SIZE });
  const counted = countsIfComplete(everything.data);
  const action = useSellerProductAction();
  const duplicate = useDuplicateSellerProduct();
  const [hiding, setHiding] = useState<SellerProduct>();
  const tabs = STATUS_TABS.map(([key, label]) => {
    const next = new URLSearchParams(params);
    if (key) next.set("status", key);
    else next.delete("status");
    next.delete("page");
    return {
      key,
      label,
      count: counted?.filter((p) => !key || p.status === key).length,
      to: { search: next.toString() },
    };
  });
  return (
    <>
      <PageHeader
        title="Products"
        description={`${everything.data ? `${everything.data.totalElements} in your shop. ` : ""}${LOW_STOCK_RULE}`}
        actions={
          <Button asChild className="min-h-11">
            <Link to="/seller/products/new">Add product</Link>
          </Button>
        }
      />
      <div className="space-y-4">
        <QueueTabs
          label="Product status"
          noun="product"
          activeKey={status}
          tabs={tabs}
        />
        <SearchField label="Search products" />
        {q.isError ? (
          <ErrorState retry={() => void q.refetch()} />
        ) : !q.data ? (
          <TableSkeleton columns={6} label="Loading products" />
        ) : q.data.totalElements === 0 ? (
          search || status ? (
            <NoResults keys={["q", "status"]} />
          ) : (
            <EmptyState
              title="No products yet."
              description="Add a product to get started."
              illustration="empty-seller-products"
              action={
                <Button asChild variant="secondary">
                  <Link to="/seller/products/new">Add your first product</Link>
                </Button>
              }
            />
          )
        ) : (
          <RowActionsContext.Provider
            value={{
              duplicating: duplicate.isPending,
              duplicate: (p) => duplicate.mutate(p.id),
              askHide: setHiding,
              unhide: (p) => action.mutate({ id: p.id, action: "unhide" }),
            }}
          >
            <DataTable
              data={q.data.content}
              columns={columns}
              total={q.data.totalElements}
              onRetry={() => void q.refetch()}
              searchable={false}
            />
          </RowActionsContext.Provider>
        )}
        <ErrorText error={action.error ?? duplicate.error} />
      </div>
      <ConfirmDialog
        open={!!hiding}
        onOpenChange={(open) => {
          if (!open) setHiding(undefined);
        }}
        title={`Hide ${hiding?.name ?? "product"}?`}
        description="Shoppers will no longer see it. You can unhide it later."
        confirmLabel="Hide product"
        destructive
        onConfirm={() => {
          if (hiding) action.mutate({ id: hiding.id, action: "hide" });
        }}
      />
    </>
  );
}
