import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Grid2X2,
  List,
  PackageOpen,
  Plus,
  Search,
  UsersRound,
  Pencil,
  Trash2,
} from "lucide-react";
import { api } from "../../api/client";
import type { Customer, Product } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
import { EntitySheet } from "./EntitySheet";

export default function CatalogPage({
  kind,
}: {
  kind: "customers" | "products";
}) {
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate(),
    client = useQueryClient();
  const [editing, setEditing] = useState<Customer | Product | null>(null),
    [open, setOpen] = useState(false),
    [deleting, setDeleting] = useState<Customer | Product | null>(null),
    [grid, setGrid] = useState(false);
  const customer = kind === "customers",
    label = customer ? "Customers" : "Products",
    page = Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0),
    q = params.get("q") ?? "",
    sort = params.get("sort") ?? "";
  useEffect(() => {
    document.title = `${label} | Payment Project`;
  }, [label]);
  const query = useQuery({
    queryKey: [kind, { page, q, sort }],
    queryFn: async () => {
      const options = {
        params: {
          query: {
            page,
            size: 20,
            ...(q ? { q } : {}),
            ...(sort ? { sort } : {}),
          },
        },
      };
      const result = customer
        ? await api.GET("/customers", options)
        : await api.GET("/products", options);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = customer
        ? await api.DELETE("/customers/{id}", { params: { path: { id } } })
        : await api.DELETE("/products/{id}", { params: { path: { id } } });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      setDeleting(null);
      void client.invalidateQueries({ queryKey: [kind] });
    },
  });
  const edit = (record: Customer | Product) => {
      setEditing(record);
      setOpen(true);
    },
    create = () => {
      setEditing(null);
      setOpen(true);
    };
  const columns: ColumnDef<Customer | Product>[] = customer
    ? [
        {
          id: "firstName",
          header: "Customer",
          accessorFn: (r) => ("firstName" in r ? r.firstName : ""),
          cell: ({ row }) => {
            const c = row.original as Customer;
            return (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
                  {c.firstName[0]}
                  {c.lastName[0]}
                </span>
                <span>
                  <span className="block font-medium">
                    {c.firstName} {c.lastName}
                  </span>
                </span>
              </div>
            );
          },
        },
        {
          id: "email",
          header: "Email",
          accessorFn: (r) => ("email" in r ? r.email : ""),
        },
        {
          id: "phoneNumber",
          header: "Phone",
          accessorFn: (r) => ("phoneNumber" in r ? r.phoneNumber : ""),
        },
      ]
    : [
        {
          id: "productName",
          header: "Product",
          accessorFn: (r) => ("productName" in r ? r.productName : ""),
          cell: ({ row }) => {
            const p = row.original as Product;
            return (
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-muted p-2 text-primary">
                  <PackageOpen size={18} />
                </span>
                <span className="font-medium">{p.productName}</span>
              </div>
            );
          },
        },
        {
          id: "productDescription",
          header: "Description",
          accessorFn: (r) =>
            "productDescription" in r ? r.productDescription : "",
        },
        {
          id: "unitPrice",
          header: "Unit price",
          accessorFn: (r) => ("unitPrice" in r ? r.unitPrice : ""),
          cell: ({ row }) => (
            <Money amount={(row.original as Product).unitPrice} />
          ),
        },
      ];
  columns.push({
    id: "actions",
    header: "Actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={`Edit ${customer ? "customer" : "product"}`}
          onClick={(e) => {
            e.stopPropagation();
            edit(row.original);
          }}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          aria-label={customer ? "Delete customer" : "Deactivate product"}
          onClick={(e) => {
            e.stopPropagation();
            setDeleting(row.original);
          }}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 size={16} />
        </button>
      </div>
    ),
  });
  const data = (query.data?.content ?? []) as (Customer | Product)[];
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  return (
    <>
      <PageHeader
        title={label}
        description={
          customer
            ? "Manage the people you do business with."
            : "Manage the products available for orders."
        }
        action={
          <Button onClick={create}>
            <Plus size={16} className="mr-2" />
            New {customer ? "customer" : "product"}
          </Button>
        }
      />
      <section className="border-t border-border bg-background p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {customer ? "Customer directory" : "Product catalog"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.data
                ? `${query.data.totalElements} ${customer ? "customers" : "products"}`
                : "Your records at a glance"}
            </p>
          </div>
          {!customer && (
            <div className="flex rounded-md border border-border p-1">
              <button
                aria-label="List view"
                aria-pressed={!grid}
                onClick={() => setGrid(false)}
                className={`rounded p-2 ${!grid ? "bg-muted text-primary" : "text-muted-foreground"}`}
              >
                <List size={17} />
              </button>
              <button
                aria-label="Grid view"
                aria-pressed={grid}
                onClick={() => setGrid(true)}
                className={`rounded p-2 ${grid ? "bg-muted text-primary" : "text-muted-foreground"}`}
              >
                <Grid2X2 size={17} />
              </button>
            </div>
          )}
        </div>
        {grid && !customer ? (
          <>
            <label className="relative block max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <input
                aria-label="Search products"
                value={q}
                onChange={(e) => update("q", e.target.value)}
                placeholder="Search products"
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <div className="mt-5">
              {query.isLoading ? (
                <div
                  role="status"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : query.isError ? (
                <ErrorState retry={() => void query.refetch()} />
              ) : !data.length ? (
                <EmptyState
                  title="No products found"
                  description="Add a product or adjust your search."
                  action={<Button onClick={create}>Add product</Button>}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.map((record) => {
                    const p = record as Product;
                    return (
                      <article
                        key={p.id}
                        className="rounded-lg border border-border p-5 transition-colors hover:bg-muted/40 motion-reduce:transition-none"
                      >
                        <div className="flex items-start justify-between">
                          <span className="rounded-lg bg-muted p-3 text-primary">
                            <PackageOpen size={20} />
                          </span>
                          <div className="flex">
                            <button
                              aria-label="Edit product"
                              onClick={() => edit(p)}
                              className="rounded p-2 hover:bg-muted"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              aria-label="Deactivate product"
                              onClick={() => setDeleting(p)}
                              className="rounded p-2 hover:bg-muted"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h3 className="mt-4 font-semibold">{p.productName}</h3>
                        <p className="mt-1 min-h-10 text-sm text-muted-foreground">
                          {p.productDescription}
                        </p>
                        <p className="mt-4 font-semibold">
                          <Money amount={p.unitPrice} />
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span>
                Page {page + 1} · {query.data?.totalElements ?? 0} results
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page === 0}
                  onClick={() => update("page", String(page - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={(page + 1) * 20 >= (query.data?.totalElements ?? 0)}
                  onClick={() => update("page", String(page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : query.isSuccess && !data.length && !q ? (
          <div className="py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
              {customer ? <UsersRound /> : <PackageOpen />}
            </div>
            <EmptyState
              title={`No ${kind} yet`}
              description={`Create your first ${customer ? "customer" : "product"} to get started.`}
              action={<Button onClick={create}>Get started</Button>}
            />
          </div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            total={query.data?.totalElements ?? 0}
            loading={query.isLoading}
            error={query.isError}
            onRetry={() => void query.refetch()}
            onRowClick={
              customer
                ? (row) => navigate(`/admin/customers/${row.id}`)
                : undefined
            }
          />
        )}
      </section>
      <EntitySheet
        kind={kind}
        record={editing}
        open={open}
        onClose={() => setOpen(false)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v && !remove.isPending) setDeleting(null);
        }}
        title={customer ? "Delete customer?" : "Deactivate product?"}
        description={
          customer
            ? "This removes the customer from the directory."
            : "This product will no longer be selectable for new orders. Existing orders retain their price snapshots."
        }
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      />
    </>
  );
}
