import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LayoutGrid, X } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../../../lib/utils";
import "./category-menu.css";
import { categoryIcon } from "./categoryIcon";
import { CategoryPane } from "./CategoryPane";
import { initialIndex, useMenuCategories, useRouteCategorySlug } from "./data";
import {
  BrowseAllLink,
  ListMessage,
  LoadingPane,
  LoadingRows,
} from "./MenuStates";

/*
 * The open sheet is a history entry (`location.state.categorySheet`), so browser / Android Back closes it. The key
 * is per page load and per instance: a reload or a second mounted menu never reopens it.
 */
const PAGE_LOAD = Math.random().toString(36).slice(2, 8);
type SheetState = { categorySheet?: string } | null;

/**
 * Below 1024 px: a 44 px icon button that opens a full-screen, two-pane sheet (BA spec §4.2): a rail of top-level
 * categories (tabs: they switch the pane, they do not navigate) and the shared `CategoryPane`. Modal (Radix
 * Dialog): focus trap, scroll lock, Esc / ✕ / Back close, focus returns to the button.
 */
export function CategorySheet({ className }: { className?: string }) {
  const uid = useId();
  const sheetKey = `${PAGE_LOAD}${uid}`;
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SheetState;
  const open = state?.categorySheet === sheetKey;

  const { tree, isLoading, isError, retry } = useMenuCategories();
  const routeSlug = useRouteCategorySlug();
  const [activeId, setActiveId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tops = tree ?? [];
  const found = tops.findIndex((c) => c.id === activeId);
  const active = found >= 0 ? found : initialIndex(tops, routeSlug);
  const current = tops[active];

  const onOpenChange = (next: boolean) => {
    if (next === open) return;
    if (next) {
      setActiveId(null);
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        { state: { ...(state ?? {}), categorySheet: sheetKey } },
      );
    } else navigate(-1);
  };
  // Links navigate with `replace` (see CategoryPane): the new page takes the sheet's history entry, which closes
  // the sheet and keeps Back from reopening it. Nothing else to do on navigate.
  const onNavigate = () => {};

  const onTabKeyDown = (e: KeyboardEvent, index: number) => {
    const n = tops.length;
    const target = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: n - 1,
    }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    const next = (target + n) % n;
    setActiveId(tops[next].id);
    tabRefs.current[next]?.focus();
  };

  const titleId = `category-sheet-title-${uid}`;
  const panelId = `category-sheet-panel-${uid}`;
  const tabId = (i: number) => `category-sheet-tab-${uid}-${i}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger
        aria-label="Categories"
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-muted",
          className,
        )}
      >
        <LayoutGrid size={20} aria-hidden="true" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        {/* Radix puts the body scroll lock on the overlay. */}
        <DialogPrimitive.Overlay className="jw-cat-scrim fixed inset-0 z-50 bg-foreground/20" />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          aria-describedby={undefined}
          className="jw-cat-sheet fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border py-1 pl-4 pr-2">
            <DialogPrimitive.Title
              id={titleId}
              className="text-h3 font-semibold"
            >
              Categories
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close categories"
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-muted"
            >
              <X size={20} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {isError || (tree && !tops.length) ? (
            <ListMessage
              error={isError}
              onRetry={retry}
              onNavigate={onNavigate}
              replace
            />
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[88px_minmax(0,1fr)]">
              <div className="min-h-0 overflow-y-auto border-r border-border">
                {isLoading || !tree ? (
                  <LoadingRows rail />
                ) : (
                  <div
                    role="tablist"
                    aria-orientation="vertical"
                    aria-label="Top-level categories"
                    className="py-1"
                  >
                    {tops.map((category, i) => {
                      const Icon = categoryIcon(category.iconName);
                      const selected = i === active;
                      return (
                        <button
                          key={category.id}
                          ref={(el) => {
                            tabRefs.current[i] = el;
                          }}
                          id={tabId(i)}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          aria-controls={panelId}
                          tabIndex={selected ? 0 : -1}
                          onClick={() => setActiveId(category.id)}
                          onKeyDown={(e) => onTabKeyDown(e, i)}
                          className={cn(
                            "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs",
                            selected
                              ? "bg-muted font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <Icon size={20} aria-hidden="true" />
                          <span className="line-clamp-2">{category.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div
                role={current ? "tabpanel" : undefined}
                id={panelId}
                aria-labelledby={current ? tabId(active) : undefined}
                className="min-h-0 overflow-y-auto p-4"
              >
                {current ? (
                  <CategoryPane
                    category={current}
                    layout="sheet"
                    headingId={`category-sheet-heading-${uid}`}
                    routeSlug={routeSlug}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <LoadingPane />
                )}
                <BrowseAllLink
                  onNavigate={onNavigate}
                  replace
                  className="mt-4"
                />
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
