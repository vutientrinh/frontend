import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Link, type To } from "react-router-dom";
import { cn } from "../lib/utils";

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  /** Action items call this; link items may omit it. */
  onSelect?: () => void;
  /** Renders the item as a router link. */
  to?: To;
  destructive?: boolean;
  disabled?: boolean;
}

const ENABLED_ITEMS = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * Row-action overflow menu (TASK-036 G2): one "more" button opening a `role="menu"` on a Radix
 * popover. Enter / Space / ArrowDown open on the first item, ArrowUp on the last; arrows wrap,
 * Home / End jump, Esc closes back to the button, Tab closes and moves on. 44 px targets.
 * Clicks do not reach a surrounding clickable row.
 */
export function DropdownMenu({
  label,
  items,
  align = "end",
  className,
}: {
  /** Accessible name of the button and menu, e.g. "More actions for Desk lamp". */
  label: string;
  items: DropdownMenuItem[];
  align?: "start" | "center" | "end";
  /** Extra classes for the trigger button. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialEdge = useRef<"first" | "last">("first");
  /** Set when we moved focus ourselves, so Radix must not move it again on close. */
  const focusHandled = useRef(false);

  if (items.length === 0) return null;

  const enabledItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(ENABLED_ITEMS) ?? [],
    );

  /**
   * Focus goes back to the button *before* the action runs, so a dialog opened by the action
   * returns focus to the button when it closes.
   */
  const closeToTrigger = () => {
    focusHandled.current = true;
    triggerRef.current?.focus();
    setOpen(false);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      // No preventDefault: the browser tabs on from the button.
      closeToTrigger();
      return;
    }
    const list = enabledItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === " " && index >= 0) {
      // Links do not activate on Space natively.
      event.preventDefault();
      list[index].click();
      return;
    }
    let next: number;
    if (event.key === "ArrowDown") next = index + 1;
    else if (event.key === "ArrowUp") next = index < 0 ? -1 : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = -1;
    else return;
    event.preventDefault();
    list.at(next % list.length)?.focus();
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) focusHandled.current = false;
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          onClick={(event) => {
            event.stopPropagation();
            initialEdge.current = "first";
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            initialEdge.current = event.key === "ArrowDown" ? "first" : "last";
            focusHandled.current = false;
            setOpen(true);
          }}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className,
          )}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={menuRef}
          role="menu"
          aria-label={label}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onMenuKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const list = enabledItems();
            list.at(initialEdge.current === "first" ? 0 : -1)?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (focusHandled.current) event.preventDefault();
          }}
          className="z-50 min-w-44 max-w-[min(90vw,20rem)] rounded-md border border-border bg-popover p-1 text-card-foreground shadow-[var(--elevation-2)]"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const itemClass = cn(
              "flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm outline-none hover:bg-muted focus:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
              item.destructive && "text-destructive",
              item.disabled &&
                "cursor-not-allowed opacity-50 hover:bg-transparent",
            );
            const content = (
              <>
                {Icon && <Icon size={16} aria-hidden="true" />}
                {item.label}
              </>
            );
            const select = () => {
              closeToTrigger();
              item.onSelect?.();
            };
            return item.to !== undefined && !item.disabled ? (
              <Link
                key={item.label}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                onClick={select}
                className={itemClass}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                onClick={item.disabled ? undefined : select}
                className={itemClass}
              >
                {content}
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
