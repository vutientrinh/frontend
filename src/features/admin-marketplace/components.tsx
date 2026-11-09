import { useState, type FormEvent, type ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePause,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Money, RelativeTime, StatusBadge } from "../../components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/dialog";
import type { AdminSellerOrderRow, AdminSellerStatus } from "./types";

const SELLER_STATUS: Record<
  AdminSellerStatus,
  { label: string; Icon: typeof CircleCheck; color: string }
> = {
  ONBOARDING: {
    label: "Onboarding",
    Icon: CircleDashed,
    color: "text-status-cancelled",
  },
  UNDER_REVIEW: {
    label: "Under review",
    Icon: Clock,
    color: "text-status-pending",
  },
  APPROVED: {
    label: "Approved",
    Icon: CircleCheck,
    color: "text-status-completed",
  },
  REJECTED: {
    label: "Rejected",
    Icon: CircleAlert,
    color: "text-status-failed",
  },
  SUSPENDED: {
    label: "Suspended",
    Icon: CirclePause,
    color: "text-status-failed",
  },
};

export function SellerStatusBadge({ status }: { status: AdminSellerStatus }) {
  const { label, Icon, color } = SELLER_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium ${color}`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Pill filter group whose value lives in the URL (the page passes value/onChange). */
export function FilterPills({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-md px-3 text-sm ${value === o.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Confirm dialog that requires a reason. The title names the object, the description
 * says what happens. Calls `onConfirm(reason)`; keeps the dialog open and shows the error
 * if it throws.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  reasons,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  reasons?: string[];
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ReasonForm
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            destructive={destructive}
            reasons={reasons}
            onCancel={() => onOpenChange(false)}
            onConfirm={async (reason) => {
              await onConfirm(reason);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  title,
  description,
  confirmLabel,
  destructive,
  reasons,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive: boolean;
  reasons?: string[];
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Enter a reason. It is saved in the audit log.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription asChild>
        <div className="text-sm text-muted-foreground">{description}</div>
      </DialogDescription>
      {reasons && (
        <div className="flex flex-wrap gap-2" aria-label="Common reasons">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <label className="block text-sm font-medium">
        Reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          aria-invalid={!!error}
          aria-describedby={error ? "reason-error" : undefined}
          className="mt-1 w-full rounded-md border border-input bg-background p-2 font-normal"
        />
      </label>
      {error && (
        <p id="reason-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
        >
          Keep as is
        </button>
        <button
          type="submit"
          disabled={busy}
          className={`min-h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50 ${destructive ? "bg-destructive text-primary-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {busy ? "Saving…" : confirmLabel}
        </button>
      </div>
    </form>
  );
}

/** Compact seller-order table for detail pages (customer 360, seller 360). */
export function OrderRowsTable({
  rows,
  showSeller = true,
  showCustomer = true,
}: {
  rows: AdminSellerOrderRow[];
  showSeller?: boolean;
  showCustomer?: boolean;
}) {
  if (!rows.length)
    return <p className="py-4 text-sm text-muted-foreground">No orders yet.</p>;
  return (
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="p-2">
              Order
            </th>
            {showSeller && (
              <th scope="col" className="p-2">
                Seller
              </th>
            )}
            {showCustomer && (
              <th scope="col" className="p-2">
                Customer
              </th>
            )}
            <th scope="col" className="p-2">
              Status
            </th>
            <th scope="col" className="p-2 text-right">
              Total
            </th>
            <th scope="col" className="p-2">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="p-2">
                <Link
                  to={`/admin/marketplace/orders/${r.id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {r.orderNumber}
                </Link>
              </td>
              {showSeller && <td className="p-2">{r.seller.name}</td>}
              {showCustomer && <td className="p-2">{r.customer.name}</td>}
              <td className="p-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="p-2 text-right">
                <Money amount={r.total} />
              </td>
              <td className="p-2 text-muted-foreground">
                <RelativeTime value={r.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="border-t border-border pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function NotFound({ what, back }: { what: string; back: string }) {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold">{what} not found</h1>
      <Link to={back} className="mt-3 inline-block text-primary">
        Back to the list
      </Link>
    </div>
  );
}
