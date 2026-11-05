import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
