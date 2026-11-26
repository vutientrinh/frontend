import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type ComponentProps } from "react";
import { cn } from "../../lib/utils";
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  // Radix only returns focus to a `DialogTrigger`. Controlled dialogs have none, so remember
  // what was focused when the dialog opened and go back to it.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 left-1/2 top-1/2 w-[min(90vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-6 text-card-foreground shadow-[var(--elevation-2)]",
          className,
        )}
        onOpenAutoFocus={(event) => {
          const active = document.activeElement;
          opener.current =
            active instanceof HTMLElement && active !== document.body
              ? active
              : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented || !opener.current?.isConnected) return;
          event.preventDefault();
          opener.current.focus();
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
