import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { Money, PageHeader } from "../../../components/shared";
import { useAdminSellers } from "../api";
import { FilterPills, SellerStatusBadge } from "../components";
import type { AdminSellerRow } from "../types";

const STATUSES = [
  { value: "", label: "All" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "APPROVED", label: "Approved" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
];

const columns: ColumnDef<AdminSellerRow>[] = [
  {
    id: "name",
    header: "Shop",
    accessorFn: (r) => r.name,
    cell: ({ row }) => (
      <span>
        <span className="block font-medium text-primary">
          {row.original.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.original.location}
        </span>
      </span>
    ),
  },
  { id: "ownerName", header: "Owner", accessorFn: (r) => r.ownerName },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status,
    cell: ({ row }) => <SellerStatusBadge status={row.original.status} />,
  },
  {
    id: "productCount",
    header: "Products",
    accessorFn: (r) => r.productCount,
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {row.original.productCount}
      </span>
    ),
  },
  {
    id: "gmv30d",
    header: "GMV 30 d",
    accessorFn: (r) => r.gmv30d,
    cell: ({ row }) => (
      <span className="block text-right">
        <Money amount={row.original.gmv30d} />
      </span>
    ),
  },
  {
    id: "commissionRatePercent",
    header: "Commission",
    accessorFn: (r) => r.commissionRatePercent,
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {row.original.commissionRatePercent}%
      </span>
    ),
  },
  {
    id: "rating",
    header: "Rating",
    accessorFn: (r) => r.rating,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.rating}</span>
    ),
  },
];

/** A-10 Sellers: status filter, search, sort and page in the URL. */
export default function SellersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get("status") ?? "";
  const list = useAdminSellers({
    status: status || undefined,
    q: params.get("q") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: Number(params.get("page")) || 0,
    size: 20,
  });
  return (
    <>
      <PageHeader
        title="Sellers"
        description="Review onboarding, suspend shops and set commission."
      />
      <section className="space-y-3 border-t border-border pt-4">
        <FilterPills
          label="Seller status"
          options={STATUSES}
          value={status}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value) next.set("status", value);
            else next.delete("status");
            next.delete("page");
            setParams(next);
          }}
        />
        <DataTable
          data={list.data?.content ?? []}
          columns={columns}
          total={list.data?.totalElements ?? 0}
          loading={list.isLoading}
          error={list.isError}
          onRetry={() => void list.refetch()}
          getRowId={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/marketplace/sellers/${r.id}`)}
        />
      </section>
    </>
  );
}
