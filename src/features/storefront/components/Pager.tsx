import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / next pager. `page` is 0-based (as the API), shown 1-based. */
export function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const button =
    "inline-flex min-h-11 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-40";
  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-center gap-3"
    >
      <button
        type="button"
        className={button}
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Previous
      </button>
      <span className="text-sm tabular-nums text-muted-foreground">
        Page {page + 1} of {totalPages}
      </span>
      <button
        type="button"
        className={button}
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
      >
        Next
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
