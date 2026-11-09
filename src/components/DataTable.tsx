import { humanLabel } from "../lib/labels";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState } from "./shared";
import { Button } from "./ui/button";
export function DataTable<T>({
  data,
  columns,
  total,
  loading,
  error,
  onRetry,
  onRowClick,
  searchable = true,
  selectedId,
  getRowId,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  total: number;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  selectedId?: string;
  getRowId?: (row: T) => string;
}) {
  "use no memo";
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0),
    size = 20;
  const sort = params.get("sort")?.split(",");
  const sorting: SortingState = sort?.[0]
    ? [{ id: sort[0], desc: sort[1] === "desc" }]
    : [];
  const hidden = (params.get("hidden") ?? "").split(",").filter(Boolean);
  const visibility: VisibilityState = Object.fromEntries(
    hidden.map((id) => [id, false]),
  );
  const update = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    if (key !== "page") p.delete("page");
    setParams(p);
  };
  // TanStack Table deliberately returns mutable callback-based table objects.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: Math.ceil(total / size),
    state: {
      sorting,
      columnVisibility: visibility,
      pagination: { pageIndex: page, pageSize: size },
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      update(
        "sort",
        next[0] ? `${next[0].id},${next[0].desc ? "desc" : "asc"}` : "",
      );
    },
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(visibility) : updater;
      update(
        "hidden",
        Object.entries(next)
          .filter(([, v]) => !v)
          .map(([k]) => k)
          .join(","),
      );
    },
  });
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap gap-3 bg-background py-2">
        {searchable && (
          <input
            aria-label="Search"
            placeholder="Search"
            value={params.get("q") ?? ""}
            onChange={(e) => update("q", e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        )}
        <details className="relative">
          <summary className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm">
            Columns
          </summary>
          <div className="absolute z-10 mt-1 rounded border border-border bg-card p-3 shadow-lg">
            {table
              .getAllLeafColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <label key={c.id} className="block whitespace-nowrap text-sm">
                  <input
                    type="checkbox"
                    checked={c.getIsVisible()}
                    onChange={c.getToggleVisibilityHandler()}
                  />{" "}
                  {c.id}
                </label>
              ))}
          </div>
        </details>
        {Array.from(params.entries())
          .filter(
            ([k]) => !["q", "page", "sort", "hidden", "selected"].includes(k),
          )
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => update(k, "")}
              className="rounded-full bg-muted px-3 text-sm"
            >
              {k}: {humanLabel(v)} ×
            </button>
          ))}
      </div>
      {error ? (
        <ErrorState retry={onRetry} />
      ) : loading ? (
        <div role="status" aria-label="Loading rows" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-muted motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title="No results"
          description="Try another search or filter."
        />
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-background text-muted-foreground">
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id} className="flex flex-wrap sm:table-row">
                  {g.headers.map((h) => (
                    <th
                      key={h.id}
                      scope="col"
                      className={`p-3 ${["amount", "orderAmount", "unitPrice"].includes(h.column.id) ? "text-right" : ""}`}
                    >
                      <button onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc"
                          ? " ↑"
                          : h.column.getIsSorted() === "desc"
                            ? " ↓"
                            : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (
                      onRowClick &&
                      event.target === event.currentTarget &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onRowClick(row.original);
                    }
                  }}
                  className={`block border-t border-border hover:bg-muted sm:table-row ${getRowId && getRowId(row.original) === selectedId ? "bg-muted" : ""}`}
                >
                  {row.getVisibleCells().map((c) => (
                    <td
                      key={c.id}
                      className={`flex justify-between gap-4 p-3 sm:table-cell ${["amount", "orderAmount", "unitPrice"].includes(c.column.id) ? "text-right tabular-nums" : ""}`}
                    >
                      <span className="font-medium sm:hidden">
                        {c.column.id}
                      </span>
                      <div className="min-w-0">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span>
          {total} results · Page {page + 1}
        </span>
        <div className="flex gap-2">
          <Button
            disabled={page === 0}
            onClick={() => update("page", String(page - 1))}
          >
            Previous
          </Button>
          <Button
            disabled={(page + 1) * size >= total}
            onClick={() => update("page", String(page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
