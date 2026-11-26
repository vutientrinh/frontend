import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";

/** Groups whole-number digits for display; no float conversion. */
function groupDigits(digits: string) {
  if (!/^\d+$/.test(digits)) return digits;
  const locale =
    localStorage.getItem("payment-locale") === "vi-VN" ? "vi-VN" : "en-US";
  return new Intl.NumberFormat(locale).format(BigInt(digits));
}

/**
 * VND amount field: shows thousands separators and ₫, reports plain digits. The caret stays
 * after the same digit when separators are added or removed.
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "ref"> & {
  value: string;
  onValueChange: (digits: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = useRef<number | null>(null);
  const shown = groupDigits(value);

  useLayoutEffect(() => {
    const input = ref.current;
    let remaining = digitsBeforeCaret.current;
    digitsBeforeCaret.current = null;
    if (!input || remaining === null || document.activeElement !== input)
      return;
    let position = 0;
    while (position < shown.length && remaining > 0) {
      if (/\d/.test(shown[position])) remaining -= 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  }, [shown]);

  return (
    <span className="relative block">
      <Input
        {...props}
        ref={ref}
        inputMode="numeric"
        value={shown}
        onChange={(event) => {
          const { value: next, selectionStart } = event.target;
          digitsBeforeCaret.current = next
            .slice(0, selectionStart ?? next.length)
            .replace(/\D/g, "").length;
          onValueChange(next.replace(/\D/g, "").replace(/^0+(?=\d)/, ""));
        }}
        className={cn("min-h-11 pr-7 text-right tabular-nums", className)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
      >
        ₫
      </span>
    </span>
  );
}
