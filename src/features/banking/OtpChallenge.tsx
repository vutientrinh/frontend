import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { request } from "./client";
import type { OtpChallenge as Challenge } from "./types";

function remaining(value: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(value) - now) / 1000));
}

export function OtpChallenge({
  challenge,
  onChange,
  onCodeChange,
  onDemoCodeChange,
  onExpired,
  code,
}: {
  challenge: Challenge;
  onChange: (challenge: Challenge) => void;
  onCodeChange?: (code: string) => void;
  onDemoCodeChange?: (code: string) => void;
  onExpired?: () => void;
  code?: string;
}) {
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const result = await request<Challenge>("/auth/otp/resend", {
        method: "POST",
        body: JSON.stringify({ otpId: challenge.otpId }),
        onMockOtp: onDemoCodeChange,
      });
      onChange(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  const canResendAt = challenge.resendAvailableAt;
  const expiry = challenge.expiresAt;
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Verification code
        <input
          required
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => onCodeChange?.(event.target.value)}
          className="mt-1 min-h-12 w-full rounded border border-border bg-background p-3 text-center font-mono text-lg tracking-[0.4em]"
        />
      </label>
      {now > 0 && expiry && remaining(expiry, now) === 0 ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            Code expired. Start verification again to request a new code.
          </p>
          {onExpired && (
            <Button
              type="button"
              className="bg-transparent p-0 text-primary"
              onClick={onExpired}
            >
              Start again
            </Button>
          )}
        </div>
      ) : expiry ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {now === 0
            ? "Checking code expiry…"
            : `Code expires in ${Math.floor(remaining(expiry, now) / 60)}:${String(remaining(expiry, now) % 60).padStart(2, "0")}`}
        </p>
      ) : null}
      {now > 0 && expiry && remaining(expiry, now) > 0 && canResendAt && (
        <p className="text-sm text-muted-foreground">
          {remaining(canResendAt, now) > 0 ? (
            <>Resend available in {remaining(canResendAt, now)} seconds.</>
          ) : (
            <Button
              type="button"
              className="h-auto bg-transparent p-0 text-primary"
              disabled={busy}
              onClick={() => void resend()}
            >
              Resend code
            </Button>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordStrength({ value }: { value: string }) {
  const strength =
    value.length < 8
      ? "Weak"
      : /[A-Za-z]/.test(value) && /\d/.test(value)
        ? "Strong"
        : "Okay";
  return (
    <span
      className="mt-1 block text-sm text-muted-foreground"
      aria-live="polite"
    >
      Password strength: {strength} · use at least 8 characters with letters and
      numbers
    </span>
  );
}
