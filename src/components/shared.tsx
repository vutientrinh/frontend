import { humanLabel } from "../lib/labels";
import { useState, type ReactNode } from "react";
import { cloneElement, type ReactElement } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  Copy,
  RotateCcw,
  CreditCard,
  Landmark,
  Package,
  PackageCheck,
  Truck,
  Ban,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { formatMoney } from "../lib/money";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
export type StatusTone =
  "success" | "warning" | "danger" | "info" | "refunded" | "neutral";

export interface StatusPresentation {
  tone: StatusTone;
  icon: LucideIcon;
  label: string;
}

const statusStyles: Record<StatusTone, string> = {
  success: "text-status-completed",
  warning: "text-status-pending",
  danger: "text-status-failed",
  info: "text-status-processing",
  refunded: "text-status-refunded",
  neutral: "text-muted-foreground",
};

const statusMap: Record<string, { tone: StatusTone; icon: LucideIcon }> = {
  COMPLETED: { tone: "success", icon: CircleCheck },
  LIVE: { tone: "success", icon: CircleCheck },
  APPROVED: { tone: "success", icon: CircleCheck },
  PAID: { tone: "success", icon: CreditCard },
  PUBLISHED: { tone: "success", icon: CircleCheck },
  CONFIRMED: { tone: "success", icon: CircleCheck },
  PACKED: { tone: "success", icon: PackageCheck },
  DELIVERED: { tone: "success", icon: PackageCheck },
  SUCCEEDED: { tone: "success", icon: CircleCheck },
  PENDING: { tone: "warning", icon: Clock },
  PENDING_PAYMENT: { tone: "warning", icon: Clock },
  CREATED: { tone: "warning", icon: Clock },
  REQUIRES_ACTION: { tone: "warning", icon: CircleAlert },
  RETURN_REQUESTED: { tone: "warning", icon: RotateCcw },
  UNDER_REVIEW: { tone: "warning", icon: Clock },
  PENDING_REVIEW: { tone: "warning", icon: Clock },
  EXPIRED: { tone: "warning", icon: Clock },
  FAILED: { tone: "danger", icon: CircleAlert },
  PAYMENT_FAILED: { tone: "danger", icon: CircleAlert },
  DELIVERY_FAILED: { tone: "danger", icon: CircleAlert },
  DECLINED: { tone: "danger", icon: CircleAlert },
  REJECTED: { tone: "danger", icon: CircleAlert },
  DRAFT: { tone: "neutral", icon: CircleDashed },
  HIDDEN: { tone: "neutral", icon: CircleDashed },
  PROCESSING: { tone: "info", icon: Clock },
  SHIPPED: { tone: "info", icon: Truck },
  IN_TRANSIT: { tone: "info", icon: Truck },
  OUT_FOR_DELIVERY: { tone: "info", icon: Truck },
  LABEL_CREATED: { tone: "info", icon: Package },
  REFUNDED: { tone: "refunded", icon: RotateCcw },
  RETURNED: { tone: "neutral", icon: RotateCcw },
  CANCELLED: { tone: "neutral", icon: Ban },
};

function getStatusPresentation(status: string): StatusPresentation {
  const normalized = status.trim().toUpperCase();
  const presentation =
    statusMap[normalized] ??
    (normalized.includes("FAIL")
      ? { tone: "danger" as const, icon: CircleAlert }
      : normalized.includes("PROCESS")
        ? { tone: "info" as const, icon: Clock }
        : { tone: "neutral" as const, icon: CircleDashed });
  return { ...presentation, label: humanLabel(normalized) };
}

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
    <span>â€”</span>
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="my-4 text-sm text-muted-foreground">
          {description}
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Confirm
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
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-describedby":
          [
            children.props["aria-describedby"],
            error ? `${id}-error` : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
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
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
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
