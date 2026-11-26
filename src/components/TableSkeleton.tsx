/** Loading placeholder with the shape of a data table (TASK-036 B6). */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  label = "Loading rows",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  const pulse = "rounded bg-muted motion-safe:animate-pulse";
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-lg border border-border"
      >
        <div className="flex gap-4 border-b border-border p-3">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className={`h-4 flex-1 ${pulse}`} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className="flex gap-4 border-b border-border p-3 last:border-b-0"
          >
            {Array.from({ length: columns }, (_, c) => (
              <div key={c} className={`h-5 flex-1 ${pulse}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
