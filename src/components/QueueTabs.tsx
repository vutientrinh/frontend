import { Link, type To } from "react-router-dom";

export interface QueueTab {
  key: string;
  label: string;
  /** Number shown in the pill; omit while loading. */
  count?: number;
  /** Link target (URL state). Without it the tab is a button calling `onSelect`. */
  to?: To;
  /** Word for the count in the accessible name, e.g. "order" → "All (3 orders)". */
  noun?: string;
}

/**
 * Underline tabs with count pills (TASK-036 B1), extracted from the shopper "My orders" page.
 * The selected tab has an underline, semibold text and a filled pill (not colour alone) and
 * `aria-current`. Targets are 44 px high; the strip scrolls sideways on narrow screens.
 */
export function QueueTabs({
  tabs,
  activeKey,
  onSelect,
  label,
  noun = "item",
}: {
  tabs: QueueTab[];
  activeKey: string;
  onSelect?: (key: string) => void;
  label: string;
  noun?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="relative -mx-4 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-24px),transparent)] [scrollbar-width:none] sm:mx-0 sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.key === activeKey;
          const word = t.noun ?? noun;
          const accessible =
            t.count === undefined
              ? undefined
              : `${t.label} (${t.count} ${t.count === 1 ? word : `${word}s`})`;
          const className = `inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm ${active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
          const content = (
            <>
              {t.label}
              {t.count !== undefined && (
                <span
                  aria-hidden="true"
                  className={`min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {t.count}
                </span>
              )}
            </>
          );
          return (
            <li key={t.key} className="shrink-0">
              {t.to !== undefined ? (
                <Link
                  to={t.to}
                  aria-current={active ? "page" : undefined}
                  aria-label={accessible}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  aria-label={accessible}
                  onClick={() => onSelect?.(t.key)}
                  className={className}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
