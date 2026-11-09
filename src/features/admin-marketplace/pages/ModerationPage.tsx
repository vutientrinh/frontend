import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
} from "../../../components/shared";
import { useModerationQueue, useModerateProduct } from "../api";
import { FilterPills, ReasonDialog } from "../components";
import type { ModerationProduct } from "../types";

const TABS = [
  { value: "PENDING_REVIEW", label: "Waiting for review" },
  { value: "REJECTED", label: "Rejected" },
];

function Preview({ product }: { product: ModerationProduct }) {
  const moderate = useModerateProduct();
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const pending = product.status === "PENDING_REVIEW";
  return (
    <article aria-label={`Preview: ${product.name}`} className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{product.name}</h2>
          <p className="text-sm text-muted-foreground">
            {product.seller.name} · {product.category.name}
          </p>
        </div>
        {pending && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="min-h-10 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setApproving(true)}
              className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Approve listing
            </button>
          </div>
        )}
      </header>
      {product.rejectionReason && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm">
          Rejected: {product.rejectionReason}
        </p>
      )}
      <ul className="flex gap-2 overflow-x-auto" aria-label="Images">
        {(product.images.length ? product.images : [product.imageUrl]).map(
          (src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <img
                src={src}
                alt={`${product.name}, image ${i + 1}`}
                width={160}
                height={160}
                className="h-40 w-40 rounded-md border border-border bg-muted object-cover"
              />
            </li>
          ),
        )}
      </ul>
      <p className="max-w-[75ch] whitespace-pre-line text-sm">
        {product.description || "No description."}
      </p>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Variants</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="p-2">
                SKU
              </th>
              <th scope="col" className="p-2">
                Options
              </th>
              <th scope="col" className="p-2 text-right">
                Price
              </th>
              <th scope="col" className="p-2 text-right">
                Stock
              </th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{v.sku}</td>
                <td className="p-2">
                  {Object.entries(v.options)
                    .map(([k, value]) => `${k}: ${value}`)
                    .join(", ")}
                </td>
                <td className="p-2 text-right">
                  <Money amount={v.price} />
                  {v.compareAtPrice && (
                    <s className="ml-2 text-xs text-muted-foreground">
                      <Money amount={v.compareAtPrice} />
                    </s>
                  )}
                </td>
                <td className="p-2 text-right tabular-nums">{v.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {product.attributes.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {product.attributes.map((a) => (
            <div key={a.name} className="contents">
              <dt className="text-muted-foreground">{a.name}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`Reject ${product.name}?`}
        description={`The listing stays hidden and ${product.seller.name} sees the reason so they can fix it and submit again.`}
        confirmLabel="Reject listing"
        reasons={[
          "Prohibited item",
          "Images do not show the product",
          "Price looks misleading",
          "Wrong category",
        ]}
        onConfirm={async (reason) => {
          await moderate.mutateAsync({
            id: product.id,
            action: "reject",
            reason,
          });
          toast.success(`Rejected ${product.name}`);
        }}
      />
      <ConfirmDialog
        open={approving}
        onOpenChange={setApproving}
        title={`Approve ${product.name}?`}
        description="The listing goes live in the store right away."
        onConfirm={() =>
          moderate.mutate(
            { id: product.id, action: "approve" },
            {
              onSuccess: () => toast.success(`${product.name} is live`),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      />
    </article>
  );
}

/** A-13 Listing moderation: queue + preview (images, variants, price), approve / reject. */
export default function ModerationPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "PENDING_REVIEW";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const queue = useModerationQueue({ status, page, size: 20 });
  const rows = queue.data?.content ?? [];
  const selectedId = params.get("selected");
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const set = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "selected") {
      next.delete("selected");
      if (key !== "page") next.delete("page");
    }
    setParams(next);
  };
  return (
    <>
      <PageHeader
        title="Listing moderation"
        description="Check new listings before they go live."
      />
      <section className="space-y-4 border-t border-border pt-4">
        <FilterPills
          label="Review status"
          options={TABS}
          value={status}
          onChange={(v) =>
            set("status", v === "PENDING_REVIEW" ? undefined : v)
          }
        />
        {queue.isError ? (
          <ErrorState retry={() => void queue.refetch()} />
        ) : queue.isLoading ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">Loading queue</span>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-14 rounded bg-muted motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              status === "PENDING_REVIEW"
                ? "Nothing waiting for review"
                : "No rejected listings"
            }
            description="New listings appear here when sellers submit them."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
            <div>
              <ul
                aria-label="Listings"
                className="divide-y divide-border border-y border-border"
              >
                {rows.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-current={p.id === selected?.id ? "true" : undefined}
                      onClick={() => set("selected", p.id)}
                      className={`flex w-full items-center gap-3 p-2 text-left hover:bg-muted ${p.id === selected?.id ? "bg-muted" : ""}`}
                    >
                      <img
                        src={p.imageUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded bg-muted object-cover"
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium">
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.seller.name} · <Money amount={p.price} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {queue.data && queue.data.totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => set("page", String(page - 1))}
                    className="min-h-10 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page + 1} of {queue.data.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page + 1 >= queue.data.totalPages}
                    onClick={() => set("page", String(page + 1))}
                    className="min-h-10 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
            {selected && <Preview key={selected.id} product={selected} />}
          </div>
        )}
      </section>
    </>
  );
}
