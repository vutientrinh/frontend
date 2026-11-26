import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

/** Right-hand sheet on the shared Dialog (focus trap, Esc, overlay) (TASK-036 B6). */
export function SideSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-auto right-0 top-0 flex h-full max-h-screen w-[min(100vw,28rem)] translate-x-0 translate-y-0 flex-col gap-4 rounded-none rounded-l-lg"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-h3 font-semibold">{title}</DialogTitle>
          <DialogClose
            aria-label="Close"
            className="-m-2 inline-flex size-11 items-center justify-center rounded-md hover:bg-muted"
          >
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </div>
        {description && (
          <DialogDescription className="text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
