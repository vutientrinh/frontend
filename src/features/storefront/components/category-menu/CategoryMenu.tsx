import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useLocation } from "react-router-dom";
import { Page } from "../../../../components/layout/Page";
import { cn } from "../../../../lib/utils";
import { useMinWidth } from "../../hooks";
import "./category-menu.css";
import { categoryIcon } from "./categoryIcon";
import { CategoryPane } from "./CategoryPane";
import { CategorySheet } from "./CategorySheet";
import { initialIndex, useMenuCategories, useRouteCategorySlug } from "./data";
import {
  BrowseAllLink,
  ListMessage,
  LoadingPane,
  LoadingRows,
} from "./MenuStates";

/** Hover on a left row switches the right pane after this delay (stops flicker on diagonal moves). */
export const HOVER_INTENT_MS = 150;
const EXIT_MS = 120;
const DESKTOP = 1024;

export interface CategoryMenuProps {
  /**
   * Icon-only 44 px trigger at every width (e.g. the start of the mobile search row). Default: the trigger shows
   * "Categories" + chevron from 1024 px and is icon-only below.
   */
  compact?: boolean;
  /** Classes for the wrapper (placement in the header). */
  className?: string;
}

/**
 * The shopper header's "Categories" button (TASK-034, BA spec Part 1 §4). From 1024 px it opens a non-modal mega
 * menu under the header (disclosure navigation, no focus trap); below 1024 px a full-screen two-pane sheet.
 */
export function CategoryMenu({
  compact = false,
  className,
}: CategoryMenuProps) {
  const desktop = useMinWidth(DESKTOP);
  return desktop ? (
    <MegaMenu compact={compact} className={className} />
  ) : (
    <CategorySheet className={className} />
  );
}

type Phase = "closed" | "open" | "closing";

function MegaMenu({
  compact,
  className,
}: Required<Pick<CategoryMenuProps, "compact">> & { className?: string }) {
  const { tree, isLoading, isError, retry } = useMenuCategories();
  const routeSlug = useRouteCategorySlug();
  const location = useLocation();
  const uid = useId();
  const panelId = `category-panel-${uid}`;
  const paneId = `category-pane-${uid}`;
  const headingId = `category-heading-${uid}`;

  const [phase, setPhase] = useState<Phase>("closed");
  // The menu belongs to the page it was opened on: any navigation closes it (no exit animation, the page changed).
  const [openedOn, setOpenedOn] = useState(location.key);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [top, setTop] = useState(0);
  const shown = phase !== "closed" && openedOn === location.key;
  const open = shown && phase === "open";

  const triggerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hoverTimer = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);
  const focusRowOnOpen = useRef(false);

  const tops = tree ?? [];
  const found = tops.findIndex((c) => c.id === activeId);
  const active = found >= 0 ? found : initialIndex(tops, routeSlug);
  const current = tops[active];

  const measure = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const header = trigger.closest("header") ?? trigger;
    setTop(Math.max(0, Math.round(header.getBoundingClientRect().bottom)));
  };

  const show = () => {
    window.clearTimeout(exitTimer.current);
    measure();
    setActiveId(null);
    setOpenedOn(location.key);
    setPhase("open");
    focusRowOnOpen.current = true;
  };
  const hide = (returnFocus = false) => {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(exitTimer.current);
    setPhase((p) => (p === "closed" ? p : "closing"));
    exitTimer.current = window.setTimeout(() => setPhase("closed"), EXIT_MS);
    if (returnFocus) triggerRef.current?.focus();
  };

  // On open (and once the rows exist), focus goes to the active row.
  useEffect(() => {
    if (!open || !focusRowOnOpen.current) return;
    const row = rowRefs.current[active];
    if (row) {
      focusRowOnOpen.current = false;
      row.focus();
    }
  });

  // Outside click (header, page, scrim) closes; the panel tracks the header while open (sticky or not).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node;
      if (
        navRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return;
      hide();
    };
    const onMove = () => measure();
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current);
      window.clearTimeout(exitTimer.current);
    },
    [],
  );

  const select = (index: number) => {
    window.clearTimeout(hoverTimer.current);
    const category = tops[index];
    if (category) setActiveId(category.id);
  };
  const focusRow = (index: number) => {
    const n = tops.length;
    const next = (index + n) % n;
    select(next);
    rowRefs.current[next]?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) show();
      else rowRefs.current[active]?.focus();
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      hide(true);
    }
  };
  const onRowKeyDown = (e: KeyboardEvent, index: number) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(index + 1),
      ArrowUp: () => focusRow(index - 1),
      Home: () => focusRow(0),
      End: () => focusRow(tops.length - 1),
      ArrowRight: () =>
        paneRef.current?.querySelector<HTMLElement>("a[href], button")?.focus(),
    };
    const run = keys[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };
  const onRowPointerEnter = (e: PointerEvent, index: number) => {
    if (e.pointerType !== "mouse" || index === active) return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(
      () => select(index),
      HOVER_INTENT_MS,
    );
  };
  const onNavKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      hide(true);
    } else if (
      e.key === "ArrowLeft" &&
      paneRef.current?.contains(e.target as Node)
    ) {
      e.preventDefault();
      rowRefs.current[active]?.focus();
    }
  };
  // Non-modal: tabbing out of the panel (to the search box, or back past the trigger) closes it.
  const onNavBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (
      next &&
      !navRef.current?.contains(next) &&
      !triggerRef.current?.contains(next)
    )
      hide();
  };

  const state = open ? "open" : "closed";
  return (
    <div className={cn("shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={shown ? panelId : undefined}
        aria-label={compact ? "Categories" : undefined}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex h-11 items-center rounded-md text-sm font-medium hover:bg-muted aria-expanded:bg-muted",
          compact ? "w-11 justify-center" : "gap-2 px-3",
        )}
      >
        <LayoutGrid size={18} aria-hidden="true" />
        {!compact && (
          <>
            Categories
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={cn(
                "transition-transform duration-[var(--motion-fast,120ms)]",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {shown && (
        <div
          className="fixed inset-x-0 bottom-0 z-40"
          style={{ top }}
          data-category-layer=""
        >
          <div
            aria-hidden="true"
            data-state={state}
            className="jw-cat-scrim absolute inset-0 bg-foreground/20"
          />
          <Page width="wide" className="relative pt-2">
            <nav
              ref={navRef}
              id={panelId}
              aria-label="Product categories"
              data-state={state}
              onKeyDown={onNavKeyDown}
              onBlur={onNavBlur}
              className="jw-cat-panel grid max-h-[min(70vh,560px)] grid-cols-[264px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-[var(--elevation-1)]"
            >
              <div className="flex min-h-0 flex-col border-r border-border">
                {isError ? (
                  <ListMessage
                    error
                    onRetry={retry}
                    onNavigate={() => hide()}
                  />
                ) : isLoading || !tree ? (
                  <LoadingRows />
                ) : !tops.length ? (
                  <ListMessage
                    error={false}
                    onRetry={retry}
                    onNavigate={() => hide()}
                  />
                ) : (
                  <>
                    <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
                      {tops.map((category, i) => {
                        const Icon = categoryIcon(category.iconName);
                        const isActive = i === active;
                        return (
                          <li key={category.id}>
                            <button
                              ref={(el) => {
                                rowRefs.current[i] = el;
                              }}
                              type="button"
                              tabIndex={isActive ? 0 : -1}
                              aria-current={isActive ? "true" : undefined}
                              aria-controls={paneId}
                              onClick={() => select(i)}
                              onFocus={() => select(i)}
                              onKeyDown={(e) => onRowKeyDown(e, i)}
                              onPointerEnter={(e) => onRowPointerEnter(e, i)}
                              onPointerLeave={() =>
                                window.clearTimeout(hoverTimer.current)
                              }
                              className={cn(
                                "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm",
                                isActive
                                  ? "bg-muted font-semibold text-primary"
                                  : "hover:bg-muted",
                              )}
                            >
                              <Icon size={18} aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">
                                {category.name}
                              </span>
                              <ChevronRight
                                size={16}
                                aria-hidden="true"
                                className="text-muted-foreground"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="border-t border-border px-3 py-1">
                      <BrowseAllLink onNavigate={() => hide()} />
                    </div>
                  </>
                )}
              </div>
              <div
                ref={paneRef}
                id={paneId}
                className="min-h-0 overflow-y-auto p-6"
              >
                {isError || (tree && !tops.length) ? null : current ? (
                  <section aria-labelledby={headingId}>
                    <CategoryPane
                      category={current}
                      layout="panel"
                      headingId={headingId}
                      routeSlug={routeSlug}
                      onNavigate={() => hide()}
                    />
                  </section>
                ) : (
                  <LoadingPane />
                )}
              </div>
            </nav>
          </Page>
        </div>
      )}
    </div>
  );
}
