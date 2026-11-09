import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clamp } from "../lib";

/** Quantity between `min` (default 1) and `max` (stock). Typed values are clamped on blur/Enter. */
export function QuantityStepper({
  id,
  label = "Quantity",
  value,
  max,
  min = 1,
  disabled = false,
  onChange,
}: {
  id: string;
  label?: string;
  value: number;
  max: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const upper = Math.max(min, max);
  const lowered = label.charAt(0).toLowerCase() + label.slice(1);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : clamp(parsed, min, upper);
    if (next !== value) onChange(next);
  };
  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta, min, upper));
  };
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-stretch rounded-md border border-border bg-card"
    >
      <button
        type="button"
        aria-label={`Decrease ${lowered}`}
        disabled={disabled || value <= min}
        onClick={() => step(-1)}
        className="grid h-11 w-11 place-items-center rounded-l-md hover:bg-muted disabled:opacity-40"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        disabled={disabled}
        value={draft ?? String(value)}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-12 border-x border-border bg-transparent text-center text-sm tabular-nums"
      />
      <span id={`${id}-hint`} className="sr-only">
        From {min} to {upper}
      </span>
      <button
        type="button"
        aria-label={`Increase ${lowered}`}
        disabled={disabled || value >= upper}
        onClick={() => step(1)}
        className="grid h-11 w-11 place-items-center rounded-r-md hover:bg-muted disabled:opacity-40"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
