import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../../../lib/utils";

const pulse = "rounded bg-muted motion-safe:animate-pulse";

/** "Browse all products →" (`/search`), the old category bar's "All categories" link. */
export function BrowseAllLink({
  onNavigate,
  replace,
  className,
}: {
  onNavigate: () => void;
  replace?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/search"
      replace={replace}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline",
        className,
      )}
    >
      Browse all products <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

/** First open before data: 8 rows on the left, a pane skeleton on the right (§4.5). */
export function LoadingRows({ rail = false }: { rail?: boolean }) {
  return (
    <ul aria-hidden="true" className={rail ? "space-y-3 p-2" : "space-y-1 p-2"}>
      {Array.from({ length: 8 }, (_, i) => (
        <li
          key={i}
          className={
            rail
              ? "flex flex-col items-center gap-2 py-1"
              : "flex items-center gap-3 px-3 py-2.5"
          }
        >
          <div className={cn(pulse, rail ? "h-6 w-6" : "h-5 w-5 shrink-0")} />
          <div className={cn(pulse, rail ? "h-3 w-12" : "h-4 w-28")} />
        </li>
      ))}
    </ul>
  );
}

export function LoadingPane() {
  return (
    <div aria-hidden="true" className="space-y-5">
      <div className={`h-6 w-40 ${pulse}`} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`h-4 w-24 ${pulse}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-3 p-2">
            <div className={`h-16 w-16 shrink-0 ${pulse}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-11/12 ${pulse}`} />
              <div className={`h-4 w-1/2 ${pulse}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Error (with Retry) or empty list. The right pane is hidden in both. */
export function ListMessage({
  error,
  onRetry,
  onNavigate,
  replace,
}: {
  error: boolean;
  onRetry: () => void;
  onNavigate: () => void;
  replace?: boolean;
}) {
  return (
    <div role={error ? "alert" : "status"} className="space-y-2 p-4 text-sm">
      <p>{error ? "Couldn’t load categories." : "No categories yet."}</p>
      {error && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md border border-border px-4 font-medium hover:bg-muted"
        >
          Retry
        </button>
      )}
      <div>
        <BrowseAllLink onNavigate={onNavigate} replace={replace} />
      </div>
    </div>
  );
}
