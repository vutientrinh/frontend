import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { Money, PageHeader, StatusBadge } from "../../../components/shared";
import { useAdminCustomers } from "../api";
import { FilterPills } from "../components";
import type { AdminCustomerRow } from "../types";

const TIERS = [
  { value: "", label: "All tiers" },
  { value: "0", label: "Tier 0" },
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
];

const columns: ColumnDef<AdminCustomerRow>[] = [
  {
    id: "fullName",
    header: "Customer",
    accessorFn: (r) => r.fullName,
    cell: ({ row }) => (
      <span className="font-medium text-primary">{row.original.fullName}</span>
    ),
  },
  { id: "phone", header: "Phone", accessorFn: (r) => r.phone },
  {
    id: "kycTier",
    header: "KYC tier",
    accessorFn: (r) => r.kycTier,
    cell: ({ row }) => `Tier ${row.original.kycTier}`,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "walletBalance",
    header: "Wallet",
    accessorFn: (r) => r.walletBalance,
    cell: ({ row }) => (
      <span className="block text-right">
        <Money amount={row.original.walletBalance} />
      </span>
    ),
  },
  {
    id: "ordersCount",
    header: "Orders",
    accessorFn: (r) => r.ordersCount,
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {row.original.ordersCount}
      </span>
    ),
  },
  {
    id: "totalSpent",
    header: "Spent",
    accessorFn: (r) => r.totalSpent,
    cell: ({ row }) => (
      <span className="block text-right">
        <Money amount={row.original.totalSpent} />
      </span>
    ),
  },
];

/** A-02 Customers: search, tier filter, sort and page in the URL. */
export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const kycTier = params.get("kycTier") ?? "";
  const list = useAdminCustomers({
    q: params.get("q") ?? undefined,
    kycTier: kycTier || undefined,
    sort: params.get("sort") ?? undefined,
    page: Number(params.get("page")) || 0,
    size: 20,
  });
  return (
    <>
      <PageHeader
        title="Customers"
        description="Shoppers with their KYC tier, wallet and order activity."
      />
      <section className="space-y-3 border-t border-border pt-4">
        <FilterPills
          label="KYC tier"
          options={TIERS}
          value={kycTier}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value) next.set("kycTier", value);
            else next.delete("kycTier");
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
          onRowClick={(r) => navigate(`/admin/marketplace/customers/${r.id}`)}
        />
      </section>
    </>
  );
}
