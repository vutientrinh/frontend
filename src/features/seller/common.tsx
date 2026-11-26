import { CircleAlert, Clock, Search, TriangleAlert, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, StatusBadge } from "../../components/shared";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  CONFIRM_SLA_MS,
  deadlineText,
  LOW_STOCK_MAX,
  useClock,
} from "./seller-utils";

export function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error instanceof Error ? error.message : "Unable to save"}
    </p>
  ) : null;
}

/** List search bound to `?q=`, with a search icon and a clear button. */
export function SearchField({ label }: { label: string }) {
  const [params, setParams] = useSearchParams();
  const value = params.get("q") ?? "";
  const update = (next: string) => {
    const p = new URLSearchParams(params);
    if (next) p.set("q", next);
    else p.delete("q");
    p.delete("page");
    setParams(p, { replace: true });
  };
  return (
    <div className="relative w-full max-w-sm">
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => update(e.target.value)}
        className="min-h-11 pl-9 pr-11 text-sm"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => update("")}
          className="absolute right-0 top-0 grid size-11 place-items-center rounded-md hover:bg-muted"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Filtered-empty state: says why the list is empty and clears the filters in `keys`. */
export function NoResults({ keys }: { keys: string[] }) {
  const [params, setParams] = useSearchParams();
  return (
    <EmptyState
      title="No results match your filters."
      description="Clear the filters to see more."
      illustration="empty-search"
      action={
        <Button
          variant="secondary"
          onClick={() => {
            const next = new URLSearchParams(params);
            [...keys, "page"].forEach((key) => next.delete(key));
            setParams(next);
          }}
        >
          Clear filters
        </Button>
      }
    />
  );
}

/** Nothing for healthy stock: only problems get a badge. */
export function StockBadge({ units }: { units: number }) {
  if (units > LOW_STOCK_MAX) return null;
  const out = units <= 0;
  return (
    <span className="whitespace-nowrap">
      <StatusBadge
        status={out ? "OUT_OF_STOCK" : "LOW_STOCK"}
        tone={out ? "danger" : "warning"}
        icon={out ? CircleAlert : TriangleAlert}
        label={out ? "Out of stock" : "Low stock"}
      />
    </span>
  );
}

/** Time left to confirm a paid order; overdue gets the warning style and icon. */
export function Deadline({ dueAt }: { dueAt: number }) {
  const now = useClock();
  const overdue = dueAt < now;
  return (
    <StatusBadge
      status="CONFIRM_DEADLINE"
      tone={overdue ? "warning" : "neutral"}
      icon={overdue ? TriangleAlert : Clock}
      label={deadlineText(dueAt, now)}
    />
  );
}

/** Confirm-by time for an order created at `createdAt`. */
export function OrderDeadline({ createdAt }: { createdAt: string }) {
  return <Deadline dueAt={Date.parse(createdAt) + CONFIRM_SLA_MS} />;
}
