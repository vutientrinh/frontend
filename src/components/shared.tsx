import { humanLabel } from "../lib/labels";
import { getStatusPresentation, statusStyles, type StatusTone } from "./status";
export { PageHeader } from "./layout/Page";
import { useState, type ReactNode } from "react";
import { cloneElement, type ReactElement } from "react";
import {
  Check,
  Copy,
  RotateCcw,
  CreditCard,
  Landmark,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { formatMoney } from "../lib/money";
import { Illustration } from "./brand/Illustration";
import type { IllustrationName } from "./brand/illustrations";
import { Link, type To } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function StatusBadge({
  status,
  tone,
  icon,
  label,
}: {
  status: string;
  tone?: StatusTone;
  icon?: LucideIcon;
  label?: string;
}) {
  const presentation = getStatusPresentation(status);
  const Icon = icon ?? presentation.icon;
  const resolvedTone = tone ?? presentation.tone;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium ${statusStyles[resolvedTone]}`}
    >
      <Icon size={14} aria-hidden="true" />
      {label ?? presentation.label}
    </span>
  );
}
export function PaymentMethod({ method }: { method: string }) {
  const methods: Record<string, { label: string; icon: LucideIcon }> = {
    VIETQR: { label: "VietQR", icon: Landmark },
    WALLET: { label: "Wallet", icon: Wallet },
    CARD: { label: "Card", icon: CreditCard },
    BANK_TRANSFER: { label: "Bank transfer", icon: Landmark },
  };
  const paymentMethod = methods[method.toUpperCase()];
  const Icon = paymentMethod?.icon ?? Wallet;
  return (
    <span className="inline-flex items-center gap-2">
      <Icon size={16} aria-hidden="true" />
      {paymentMethod?.label ?? humanLabel(method)}
    </span>
  );
}
export function MoneyText({
  amount,
  currency = "VND",
  size = "default",
  tone = "default",
  sign,
}: {
  amount: string;
  currency?: string;
  size?: "default" | "small" | "display";
  tone?: "default" | "success" | "muted";
  sign?: "minus" | "plus";
}) {
  const formatted = formatMoney(amount, currency);
  const locale =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("payment-locale") === "vi-VN"
      ? "vi-VN"
      : "en-US";
  const currencyMark = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;
  const value = currencyMark
    ? formatted.replace(currencyMark, "").trim()
    : formatted;
  return (
    <span
      aria-label={`${sign === "minus" ? "−" : sign === "plus" ? "+" : ""}${formatted}`}
      className={`whitespace-nowrap tabular-nums ${size === "small" ? "text-small" : size === "display" ? "text-display font-bold tracking-[-0.02em]" : ""} ${tone === "success" ? "text-success" : tone === "muted" ? "text-muted-foreground" : ""}`}
    >
      {sign === "minus" && "−"}
      {sign === "plus" && <span className="text-success">+</span>}
      {value}
      {currencyMark && (
        <span className="ml-0.5 text-[0.7em] font-normal text-muted-foreground">
          {currencyMark}
        </span>
      )}
    </span>
  );
}
export const Money = MoneyText;
export function RelativeTime({ value }: { value: string }) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? (
    <span>—</span>
  ) : (
    <time dateTime={value} title={date.toLocaleString()}>
      {formatDistanceToNow(date, { addSuffix: true })}
    </time>
  );
}
export function EmptyState({
  title,
  description,
  action,
  illustration,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Scene from the kit (DESIGN.md §8); only for empty / success / error states. */
  illustration?: IllustrationName;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      {illustration && (
        <Illustration name={illustration} size="sm" className="mb-4" />
      )}
      <h2 className="font-semibold">{title}</h2>
      {description && (
        <p className="my-2 text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}
export function ErrorState({
  message = "Unable to load data",
  retry,
}: {
  message?: string;
  retry: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-border p-6">
      <Illustration name="error-generic" size="sm" className="mb-3" />
      <p>{message}</p>
      <Button onClick={retry} className="mt-3">
        <RotateCcw size={16} /> Retry
      </Button>
    </div>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  destructive = false,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Receives the trimmed reason when `reason` is set. */
  onConfirm: (reason?: string) => void;
  confirmLabel?: string;
  destructive?: boolean;
  /** Adds a reason field inside the dialog; `required` blocks Confirm until it is filled. */
  reason?: { label: string; required?: boolean; placeholder?: string };
}) {
  const [text, setText] = useState("");
  const missing = !!reason?.required && text.trim() === "";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setText("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="my-4 text-sm text-muted-foreground">
          {description}
        </DialogDescription>
        {reason && (
          <div className="mb-4">
            <FormField
              id="confirm-reason"
              label={reason.label}
              required={reason.required}
            >
              <textarea
                rows={3}
                value={text}
                placeholder={reason.placeholder}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            </FormField>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={missing}
            onClick={() => {
              onConfirm(reason ? text.trim() : undefined);
              setText("");
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  counter,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  /** Helper text under the control (linked with aria-describedby). */
  hint?: string;
  /** Shows the red marker inline after the label text (never wraps to its own line). */
  required?: boolean;
  /** Character counter, e.g. `{ value: name.length, max: 120 }`. */
  counter?: { value: number; max: number };
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </label>
        {counter && (
          <span
            className={`text-xs tabular-nums ${counter.value > counter.max ? "text-destructive" : "text-muted-foreground"}`}
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        ...(required ? { "aria-required": true } : {}),
        "aria-describedby":
          [
            children.props["aria-describedby"],
            hintId,
            error ? `${id}-error` : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
export function StatCard({
  label,
  value,
  detail,
  to,
  trend,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  /** Makes the whole card a link (e.g. to the list behind the number). */
  to?: To;
  /** Change vs the previous period; the arrow and text carry the meaning, not colour alone. */
  trend?: { value: string; direction: "up" | "down" | "flat" };
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {trend && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${trend.direction === "up" ? "text-success" : trend.direction === "down" ? "text-destructive" : "text-muted-foreground"}`}
        >
          <span aria-hidden="true">
            {trend.direction === "up"
              ? "▲"
              : trend.direction === "down"
                ? "▼"
                : "–"}
          </span>
          {trend.value}
        </p>
      )}
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </>
  );
  const base = "block rounded-lg border border-border bg-card p-5";
  return to === undefined ? (
    <div className={base}>{body}</div>
  ) : (
    <Link to={to} className={`${base} hover:bg-muted`}>
      {body}
    </Link>
  );
}
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label="Copy to clipboard"
      className="rounded p-2 hover:bg-muted"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied");
        } catch {
          toast.error("Could not copy");
        }
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}
export function KeyValueList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="divide-y divide-border">
      {items.map((x) => (
        <div key={x.label} className="flex justify-between gap-4 py-3">
          <dt className="text-sm text-muted-foreground">{x.label}</dt>
          <dd className="text-sm">{x.value}</dd>
        </div>
      ))}
    </dl>
  );
}
