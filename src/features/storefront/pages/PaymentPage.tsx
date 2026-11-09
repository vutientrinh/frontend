import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  LoaderCircle,
  QrCode,
  Wallet as WalletIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiError } from "../../banking/client";
import { ErrorState, StatusBadge } from "../../../components/shared";
import {
  useCancelPayment,
  useConfirmPayment,
  usePaymentIntent,
  useSimulatePayment,
} from "../../commerce/api";
import type { CheckoutResult, PaymentIntent } from "../../commerce/types";
import { QrImage } from "../components/QrImage";
import { ReservationTimer } from "../components/ReservationTimer";
import { ListSkeleton } from "../components/States";
import { Amount } from "../components/Amount";
import { errorMessage } from "../hooks";
import { type } from "../type";

const ACTIVE = ["CREATED", "PROCESSING", "REQUIRES_ACTION"];
const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

function OtpForm({ intent }: { intent: PaymentIntent }) {
  const confirm = useConfirmPayment();
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(undefined);
    try {
      await confirm.mutateAsync({
        id: intent.id,
        otpId: intent.otpId ?? "",
        code,
        idempotencyKey: `${attempt}-${code}`,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not confirm the payment."));
      setAttempt(crypto.randomUUID());
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
      <p className="text-sm">
        Enter the one-time code we sent to your phone to pay{" "}
        <Amount amount={intent.amount} /> from your wallet.
      </p>
      <label className="block text-sm font-medium">
        One-time code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-invalid={!!error}
          aria-describedby={error ? "otp-error" : "otp-hint"}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1 block min-h-12 w-48 rounded-md border border-input bg-background px-3 font-mono text-xl tracking-[0.3em] tabular-nums"
        />
      </label>
      {import.meta.env.DEV && (
        <p id="otp-hint" className="text-xs text-muted-foreground">
          Mock OTP: 123456
        </p>
      )}
      {error && (
        <p id="otp-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={confirm.isPending}
        className={primaryButton}
      >
        {confirm.isPending ? "Confirming…" : "Confirm payment"}
      </button>
    </form>
  );
}

/** A value with its own named copy button ("Copy reference"), so several sit side by side. */
function CopyField({
  label,
  value,
  display,
}: {
  label: string;
  value: string;
  display: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border py-1 pl-3 pr-1">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-semibold">{display}</dd>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => void copy()}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-muted"
      >
        {copied ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** VietQR card: QR on the left; amount, reference, countdown and status on the right (md+). */
function VietQrStep({
  intent,
  onExpire,
}: {
  intent: PaymentIntent;
  onExpire: () => void;
}) {
  const simulate = useSimulatePayment();
  return (
    <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
      <div className="mx-auto md:mx-0">
        {intent.qrPayload ? (
          <QrImage payload={intent.qrPayload} label="VietQR payment code" />
        ) : (
          <p className="text-sm text-muted-foreground">
            No QR code for this payment. Transfer using the reference.
          </p>
        )}
      </div>
      <div className="min-w-0 space-y-4">
        <p className="text-sm">
          Scan with your banking app and transfer the exact amount with the
          reference below.
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <CopyField
            label="Amount"
            value={intent.amount}
            display={<Amount amount={intent.amount} />}
          />
          {intent.reference && (
            <CopyField
              label="Reference"
              value={intent.reference}
              display={<code className="font-mono">{intent.reference}</code>}
            />
          )}
        </dl>
        <ReservationTimer
          expiresAt={intent.expiresAt}
          label="Complete payment within"
          onExpire={onExpire}
        />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle
            size={16}
            aria-hidden="true"
            className="motion-safe:animate-spin"
          />
          Waiting for your bank transfer…
        </p>
        {import.meta.env.DEV && (
          <div className="rounded-md border border-dashed border-border p-3 text-sm">
            <p className="text-muted-foreground">
              Developer tools (until VietQR is connected to the bank simulator)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["SUCCEEDED", "FAILED"] as const).map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  disabled={simulate.isPending}
                  onClick={() => simulate.mutate({ id: intent.id, outcome })}
                  className="min-h-11 rounded-md border border-input px-3 font-medium hover:bg-muted disabled:opacity-50"
                >
                  Simulate {outcome === "SUCCEEDED" ? "success" : "failure"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function heroTitle(intent: PaymentIntent, active: boolean) {
  if (active)
    return intent.method === "WALLET" ? "Pay with wallet" : "Pay with VietQR";
  if (intent.status === "SUCCEEDED") return "Payment received";
  if (intent.status === "EXPIRED") return "Payment expired";
  if (intent.status === "CANCELLED") return "Payment cancelled";
  return "Payment failed";
}

/** Status hero (C6): icon + title + amount, so the state reads at a glance. */
function PaymentHero({
  intent,
  active,
  orderNumber,
}: {
  intent: PaymentIntent;
  active: boolean;
  orderNumber?: string;
}) {
  const ok = intent.status === "SUCCEEDED";
  const Icon = active
    ? intent.method === "WALLET"
      ? WalletIcon
      : QrCode
    : ok
      ? CircleCheck
      : CircleAlert;
  const tone = ok
    ? "text-success"
    : active
      ? "text-primary"
      : "text-destructive";
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-border pb-6">
      <span
        aria-hidden="true"
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted ${tone}`}
      >
        <Icon size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className={type.h2}>{heroTitle(intent, active)}</h1>
        <p className="text-sm text-muted-foreground">
          Order {orderNumber ?? intent.orderNumber}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-border pt-3 sm:w-auto sm:flex-col sm:items-end sm:gap-1 sm:border-0 sm:pt-0">
        <p className={type.display}>
          <span className="sr-only">Amount </span>
          <Amount amount={intent.amount} />
        </p>
        <span aria-live="polite">
          <StatusBadge status={intent.status} />
        </span>
      </div>
    </header>
  );
}

/** W-17 Payment step: wallet OTP or VietQR, live status until terminal, retry on failure. */
export default function PaymentPage() {
  const { intentId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const checkoutResult = (
    location.state as { checkout?: CheckoutResult } | null
  )?.checkout;
  const intent = usePaymentIntent(intentId);
  const cancel = useCancelPayment();
  const status = intent.data?.status;

  useEffect(() => {
    if (status === "SUCCEEDED" && checkoutResult)
      navigate(`/orders/success/${checkoutResult.parentOrderId}`, {
        replace: true,
        state: { checkout: checkoutResult },
      });
  }, [status, checkoutResult, navigate]);

  if (intent.isError)
    return intent.error instanceof ApiError && intent.error.status === 404 ? (
      <div className="py-10">
        <h1 className={type.h1}>Payment not found</h1>
        <Link to="/me/orders" className="mt-4 inline-block text-primary">
          View my orders
        </Link>
      </div>
    ) : (
      <ErrorState
        message="Could not load the payment."
        retry={() => void intent.refetch()}
      />
    );
  if (intent.isLoading || !intent.data)
    return <ListSkeleton rows={1} label="Loading payment" />;

  const p = intent.data;
  const active = ACTIVE.includes(p.status);
  const otherMethod = p.method === "WALLET" ? "VIETQR" : "WALLET";
  const refetch = () => void intent.refetch();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PaymentHero
        intent={p}
        active={active}
        orderNumber={checkoutResult?.orderNumber}
      />

      {active && (
        <>
          <section
            aria-label={
              p.method === "VIETQR" ? "VietQR transfer" : "Wallet payment"
            }
            className="rounded-lg border border-border bg-card p-4 sm:p-6"
          >
            {p.method === "VIETQR" &&
            !(p.status === "REQUIRES_ACTION" && p.otpRequired) ? (
              <VietQrStep intent={p} onExpire={refetch} />
            ) : (
              <div className="space-y-4">
                <ReservationTimer
                  expiresAt={p.expiresAt}
                  label="Complete payment within"
                  onExpire={refetch}
                />
                {p.status === "REQUIRES_ACTION" && p.otpRequired ? (
                  <OtpForm intent={p} />
                ) : (
                  <p role="status" className="flex items-center gap-2 text-sm">
                    <LoaderCircle
                      size={16}
                      aria-hidden="true"
                      className="motion-safe:animate-spin"
                    />
                    Charging your wallet…
                  </p>
                )}
              </div>
            )}
          </section>
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(p.id)}
            className="min-h-11 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cancel payment and release items
          </button>
        </>
      )}

      {p.status === "SUCCEEDED" && (
        <section role="status" className="space-y-3">
          <p className="flex items-center gap-2 font-medium text-success">
            <CircleCheck size={20} aria-hidden="true" /> Payment received
          </p>
          <Link to="/me/orders?tab=TO_SHIP" className={primaryButton}>
            View my orders
          </Link>
        </section>
      )}

      {!active && p.status !== "SUCCEEDED" && (
        <section role="alert" className="space-y-3">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <CircleAlert size={20} aria-hidden="true" />
            {p.status === "EXPIRED"
              ? "The payment window expired."
              : p.status === "CANCELLED"
                ? "Payment cancelled."
                : "Payment failed."}
          </p>
          <p className="text-sm text-muted-foreground">
            {p.failureReason ? `${p.failureReason}. ` : ""}
            No money was taken and the items were released.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                navigate("/checkout", { state: { method: otherMethod } })
              }
              className={primaryButton}
            >
              Try again with {otherMethod === "WALLET" ? "wallet" : "VietQR"}
            </button>
            <Link
              to="/cart"
              className="inline-flex min-h-12 items-center rounded-md border border-input px-5 text-base font-medium hover:bg-muted"
            >
              Back to cart
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
