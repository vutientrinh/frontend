import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** Native select styled like `Input` (uses the `input` border token, 44 px touch height). */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <span className="relative block w-full">
      <select
        className={cn(
          "min-h-11 w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-9 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 sm:min-h-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
