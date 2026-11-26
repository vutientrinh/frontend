import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Native checkbox drawn with the `input` border token. The whole row (label included) is the
 * 44 px target. Pass `label` for a visible label, or `aria-label` when the label sits elsewhere.
 */
export function Checkbox({
  className,
  label,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label?: ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <span className="relative inline-flex size-5 shrink-0">
        <input
          type="checkbox"
          className="peer size-5 cursor-[inherit] appearance-none rounded-[4px] border border-input bg-background checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          {...props}
        />
        <Check
          size={14}
          strokeWidth={3}
          aria-hidden="true"
          className="pointer-events-none absolute left-[3px] top-[3px] hidden text-primary-foreground peer-checked:block"
        />
      </span>
      {label}
    </label>
  );
}
