import { PackageOpen, SearchX, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { productGridClass } from "../lib";

const pulse = "rounded bg-muted motion-safe:animate-pulse";

/** Same shape as a ProductCard grid. */
export function ProductGridSkeleton({
  count = 8,
  label = "Loading products",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul className={productGridClass} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-lg border border-border"
          >
            <div className={`aspect-square ${pulse} rounded-none`} />
            <div className="space-y-2 p-3">
              <div className={`h-4 w-11/12 ${pulse}`} />
              <div className={`h-4 w-2/3 ${pulse}`} />
              <div className={`h-5 w-1/2 ${pulse}`} />
              <div className={`h-3 w-1/3 ${pulse}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rows with a thumbnail, two text lines and an amount: cart items, order cards. */
export function ListSkeleton({
  rows = 3,
  label = "Loading",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul
        aria-hidden="true"
        className="divide-y divide-border rounded-lg border border-border"
      >
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex gap-3 p-4">
            <div className={`h-16 w-16 shrink-0 ${pulse}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-3/4 ${pulse}`} />
              <div className={`h-3 w-1/3 ${pulse}`} />
            </div>
            <div className={`h-4 w-20 ${pulse}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StoreEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 max-w-[50ch] text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

const primaryLink =
  "inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90";

export function EmptyCart() {
  return (
    <StoreEmpty
      icon={<ShoppingCart size={22} aria-hidden="true" />}
      title="Your cart is empty"
      description="Items you add from any shop appear here, grouped by seller."
      action={
        <Link to="/" className={primaryLink}>
          Start shopping
        </Link>
      }
    />
  );
}

export function NoResults({
  query,
  onClear,
}: {
  query?: string;
  onClear: () => void;
}) {
  return (
    <StoreEmpty
      icon={<SearchX size={22} aria-hidden="true" />}
      title={query ? `No products match “${query}”` : "No products match"}
      description="Try fewer filters, a wider price range or a different word."
      action={
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-md border border-border px-4 text-sm font-medium text-primary hover:bg-muted"
        >
          Clear filters
        </button>
      }
    />
  );
}

export function NoOrders({ tabLabel }: { tabLabel?: string }) {
  return (
    <StoreEmpty
      icon={<PackageOpen size={22} aria-hidden="true" />}
      title={tabLabel ? `No orders in “${tabLabel}”` : "No orders yet"}
      description="Orders you place show up here with their status and tracking."
      action={
        <Link to="/" className={primaryLink}>
          Continue shopping
        </Link>
      }
    />
  );
}
