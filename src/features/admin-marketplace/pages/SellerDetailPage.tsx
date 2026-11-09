import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiError } from "../../banking/client";
import {
  ConfirmDialog,
  ErrorState,
  KeyValueList,
  Money,
  PageHeader,
} from "../../../components/shared";
import { humanLabel } from "../../../lib/labels";
import {
  useAdminSeller,
  useSellerAction,
  useSellerCommission,
  type SellerAction,
} from "../api";
import {
  NotFound,
  OrderRowsTable,
  ReasonDialog,
  Section,
  SellerStatusBadge,
} from "../components";
import { normalizeRate, rateError } from "../lib";
import type { AdminSellerDetail } from "../types";

function CommissionEditor({ seller }: { seller: AdminSellerDetail }) {
  const save = useSellerCommission();
  const [value, setValue] = useState(seller.commissionRatePercent);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = rateError(value);
    setError(problem);
    if (!problem) setConfirming(true);
  };
  const next = normalizeRate(value);
  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor="commission" className="block text-sm font-medium">
        Commission rate (%)
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <input
          id="commission"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!!error}
          aria-describedby={error ? "commission-error" : "commission-hint"}
          className="min-h-10 w-28 rounded-md border border-input bg-background px-3 tabular-nums"
        />
        <button
          type="submit"
          disabled={save.isPending || next === seller.commissionRatePercent}
          className="min-h-10 rounded-md border border-input px-4 text-sm font-medium text-primary hover:bg-muted disabled:opacity-50"
        >
          Update commission
        </button>
      </div>
      {error ? (
        <p
          id="commission-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : (
        <p id="commission-hint" className="text-xs text-muted-foreground">
          0–30 %, one decimal. Applies to orders placed after the change.
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Change commission for ${seller.name}?`}
        description={`From ${seller.commissionRatePercent}% to ${next}%. New orders from this shop use the new rate; existing orders keep theirs.`}
        onConfirm={() =>
          save.mutate(
            { id: seller.id, ratePercent: next },
            {
              onSuccess: () => toast.success(`Commission set to ${next}%`),
              onError: (err) => setError(err.message),
            },
          )
        }
      />
    </form>
  );
}

function StepData({ data }: { data?: Record<string, unknown> | object }) {
  if (!data)
    return <p className="text-sm text-muted-foreground">Not submitted yet.</p>;
  return (
    <KeyValueList
      items={Object.entries(data).map(([key, value]) => ({
        label: humanLabel(key.replace(/([a-z])([A-Z])/g, "$1_$2")),
        value: Array.isArray(value)
          ? value.join(", ") || "—"
          : String(value ?? "—"),
      }))}
    />
  );
}

const DIALOGS: Record<
  Exclude<SellerAction, "approve" | "reinstate">,
  { verb: string; description: (name: string) => string; reasons: string[] }
> = {
  reject: {
    verb: "Reject",
    description: (name) =>
      `${name} cannot sell until they fix the onboarding data and submit again. The reason is shown to the seller.`,
    reasons: [
      "ID photo is unreadable",
      "Bank account holder does not match the owner",
      "Business documents missing",
    ],
  },
  suspend: {
    verb: "Suspend",
    description: (name) =>
      `All live products of ${name} are hidden from the store until you reinstate the shop. Open orders continue.`,
    reasons: ["Counterfeit goods reported", "Repeated late shipping"],
  },
};

/** A-11 Seller 360: onboarding review, approve / reject / suspend, commission, orders. */
export default function SellerDetailPage() {
  const { id = "" } = useParams();
  const seller = useAdminSeller(id);
  const action = useSellerAction();
  const [dialog, setDialog] = useState<"reject" | "suspend">();
  const [confirm, setConfirm] = useState<"approve" | "reinstate">();

  if (seller.isError)
    return seller.error instanceof ApiError && seller.error.status === 404 ? (
      <NotFound what="Seller" back="/admin/marketplace/sellers" />
    ) : (
      <ErrorState retry={() => void seller.refetch()} />
    );
  if (seller.isLoading || !seller.data)
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading seller</span>
        <div className="h-8 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-40 rounded bg-muted motion-safe:animate-pulse" />
      </div>
    );
  const s = seller.data;
  const run = (kind: SellerAction, reason?: string) =>
    action
      .mutateAsync({ id: s.id, action: kind, reason })
      .then(() =>
        toast.success(
          `${s.name} ${kind === "approve" ? "approved" : kind === "reject" ? "rejected" : kind === "suspend" ? "suspended" : "reinstated"}`,
        ),
      );
  const canReview = s.status === "UNDER_REVIEW" || s.status === "REJECTED";

  return (
    <>
      <Link
        to="/admin/marketplace/sellers"
        className="text-sm text-primary hover:underline"
      >
        Sellers
      </Link>
      <PageHeader
        title={s.name}
        description={`${s.ownerName} · ${s.location} · /shop/${s.slug}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SellerStatusBadge status={s.status} />
            {canReview && (
              <button
                type="button"
                onClick={() => setConfirm("approve")}
                className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Approve seller
              </button>
            )}
            {s.status === "UNDER_REVIEW" && (
              <button
                type="button"
                onClick={() => setDialog("reject")}
                className="min-h-10 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
              >
                Reject
              </button>
            )}
            {s.status === "APPROVED" && (
              <button
                type="button"
                onClick={() => setDialog("suspend")}
                className="min-h-10 rounded-md border border-input px-4 text-sm font-medium text-destructive hover:bg-muted"
              >
                Suspend shop
              </button>
            )}
            {s.status === "SUSPENDED" && (
              <button
                type="button"
                onClick={() => setConfirm("reinstate")}
                className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Reinstate shop
              </button>
            )}
          </div>
        }
      />
      {s.statusReason && (
        <p
          role="status"
          className="mb-6 rounded-md border border-border bg-muted p-3 text-sm"
        >
          Reason: {s.statusReason}
        </p>
      )}
      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Shop info">
          <StepData data={s.onboarding.shop} />
        </Section>
        <Section title="Owner identity">
          <StepData data={s.onboarding.owner} />
        </Section>
        <Section title="Business documents">
          <StepData data={s.onboarding.documents} />
        </Section>
        <Section title="Bank account">
          <StepData data={s.onboarding.bank} />
        </Section>
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <Section title="Commission">
          <CommissionEditor key={s.commissionRatePercent} seller={s} />
        </Section>
        <Section title="Products">
          <KeyValueList
            items={[
              { label: "Live", value: s.products.live },
              { label: "Waiting for review", value: s.products.pendingReview },
              { label: "Rejected", value: s.products.rejected },
              { label: "Hidden", value: s.products.hidden },
              { label: "Out of stock", value: s.products.outOfStock },
              { label: "GMV 30 days", value: <Money amount={s.gmv30d} /> },
            ]}
          />
          {s.products.pendingReview > 0 && (
            <Link
              to="/admin/marketplace/moderation"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Open moderation queue
            </Link>
          )}
        </Section>
      </div>
      <div className="mt-8">
        <Section title="Recent orders">
          <OrderRowsTable rows={s.recentOrders} showSeller={false} />
        </Section>
      </div>
      {dialog && (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setDialog(undefined)}
          title={`${DIALOGS[dialog].verb} ${s.name}?`}
          description={DIALOGS[dialog].description(s.name)}
          confirmLabel={`${DIALOGS[dialog].verb} seller`}
          reasons={DIALOGS[dialog].reasons}
          onConfirm={(reason) => run(dialog, reason)}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={
          confirm === "approve" ? `Approve ${s.name}?` : `Reinstate ${s.name}?`
        }
        description={
          confirm === "approve"
            ? "The shop can list products and receive orders right away."
            : "Products hidden by the suspension go live again."
        }
        onConfirm={() =>
          confirm &&
          void run(confirm).catch((err: Error) => toast.error(err.message))
        }
      />
    </>
  );
}
