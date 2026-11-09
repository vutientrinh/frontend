import { humanLabel } from "../../lib/labels";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import type { OutboxEvent } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import {
  ErrorState,
  KeyValueList,
  PageHeader,
  RelativeTime,
  StatusBadge,
} from "../../components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/dialog";
export default function EventMonitor() {
  const [params, setParams] = useSearchParams(),
    [id, setId] = useState(""),
    [refresh, setRefresh] = useState(false),
    status = params.get("status") ?? "",
    eventType = params.get("eventType") ?? "",
    page = Math.max(0, parseInt(params.get("page") ?? "0", 10) || 0),
    sort = params.get("sort") ?? "";
  useEffect(() => {
    document.title = "Event monitor | Payment Project";
  }, []);
  const query = useQuery({
    queryKey: ["events", { status, eventType, page, sort }],
    queryFn: async () => {
      const r = await api.GET("/outbox-events", {
        params: {
          query: {
            page,
            size: 20,
            ...(status ? { status } : {}),
            ...(eventType ? { eventType } : {}),
            ...(sort ? { sort } : {}),
          },
        },
      });
      if (r.error) throw r.error;
      return r.data;
    },
    refetchInterval: refresh ? 5000 : false,
  });
  const counts = useQuery({
    queryKey: ["event-counts"],
    queryFn: async () => {
      const out = await Promise.all(
        ["PENDING", "PUBLISHED", "FAILED"].map((status) =>
          api.GET("/outbox-events", { params: { query: { status, size: 1 } } }),
        ),
      );
      return out.map((r) => {
        if (r.error) throw r.error;
        return r.data.totalElements;
      });
    },
    refetchInterval: refresh ? 5000 : false,
  });
  const detail = useQuery({
    queryKey: ["event", id],
    enabled: !!id,
    queryFn: async () => {
      const r = await api.GET("/outbox-events/{id}", {
        params: { path: { id } },
      });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const update = (key: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(key, v);
    else p.delete(key);
    p.delete("page");
    setParams(p);
  };
  const columns: ColumnDef<OutboxEvent>[] = [
    { id: "eventType", header: "Event type", accessorKey: "eventType" },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    { id: "attempts", header: "Attempts", accessorKey: "attempts" },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      cell: ({ row }) => <RelativeTime value={row.original.createdAt} />,
    },
    {
      id: "nextRetryAt",
      header: "Next retry",
      accessorKey: "nextRetryAt",
      cell: ({ row }) =>
        row.original.nextRetryAt ? (
          <RelativeTime value={row.original.nextRetryAt} />
        ) : (
          "—"
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Event monitor"
        description="Inspect outbox delivery and retries."
        action={
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refresh}
              onChange={(e) => setRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
        }
      />
      <section className="border-t border-border bg-background p-5">
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap gap-2 bg-background py-2">
          {["", "PENDING", "PUBLISHED", "FAILED"].map((s, i) => (
            <button
              key={s}
              aria-pressed={status === s}
              onClick={() => update("status", s)}
              className={`rounded px-3 py-2 text-sm ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {s ? humanLabel(s) : "All"}
              {i > 0 && counts.data ? ` (${counts.data[i - 1]})` : ""}
            </button>
          ))}
        </div>
        {counts.isError && (
          <p role="status" className="mb-3 text-sm text-destructive">
            Status counts unavailable.{" "}
            <button className="underline" onClick={() => void counts.refetch()}>
              Retry counts
            </button>
          </p>
        )}
        <label className="mb-4 block max-w-xs text-sm">
          Event type
          <select
            value={eventType}
            onChange={(e) => update("eventType", e.target.value)}
            className="ml-2 rounded border border-border bg-background p-2"
          >
            <option value="">All types</option>
            <option value="payment.requested.v1">payment.requested.v1</option>
            <option value="payment.status-changed.v1">
              payment.status-changed.v1
            </option>
          </select>
        </label>
        <DataTable
          searchable={false}
          data={query.data?.content ?? []}
          columns={columns}
          total={query.data?.totalElements ?? 0}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => void query.refetch()}
          onRowClick={(row) => setId(row.id)}
        />
      </section>
      <Dialog
        open={!!id}
        onOpenChange={(open) => {
          if (!open) setId("");
        }}
      >
        <DialogContent className="left-auto right-0 top-0 h-[100dvh] w-full max-w-md translate-x-0 translate-y-0 overflow-auto rounded-none">
          <DialogTitle className="text-lg font-semibold">
            Event detail
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Delivery metadata; payload is not shown.
          </DialogDescription>
          {detail.isLoading ? (
            <p role="status" className="mt-5">
              Loading event…
            </p>
          ) : detail.isError || !detail.data ? (
            <ErrorState retry={() => void detail.refetch()} />
          ) : (
            <KeyValueList
              items={[
                { label: "ID", value: detail.data.id },
                { label: "Type", value: detail.data.eventType },
                {
                  label: "Status",
                  value: <StatusBadge status={detail.data.status} />,
                },
                { label: "Attempts", value: detail.data.attempts },
                { label: "Next retry", value: detail.data.nextRetryAt ?? "—" },
                { label: "Last error", value: detail.data.lastError ?? "—" },
                { label: "Created", value: detail.data.createdAt },
                { label: "Published", value: detail.data.publishedAt ?? "—" },
              ]}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
