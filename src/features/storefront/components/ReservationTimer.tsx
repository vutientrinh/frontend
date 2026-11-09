import { useEffect, useEffectEvent, useState } from "react";
import { Clock } from "lucide-react";
import { formatRemaining } from "../lib";

function remainingMs(expiresAt: string, now: number) {
  return Math.max(0, Date.parse(expiresAt) - now);
}

/**
 * Countdown to `expiresAt` (stock reservation / payment intent). Visually updates every second;
 * screen readers hear it only at 5 min, 1 min and expiry. Calls `onExpire` once.
 */
export function ReservationTimer({
  expiresAt,
  onExpire,
  label = "Items reserved for",
}: {
  expiresAt: string;
  onExpire?: () => void;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fireExpire = useEffectEvent(() => onExpire?.());

  useEffect(() => {
    if (remainingMs(expiresAt, Date.now()) === 0) {
      fireExpire();
      return;
    }
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (remainingMs(expiresAt, current) === 0) {
        window.clearInterval(timer);
        fireExpire();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const ms = remainingMs(expiresAt, now);
  const expired = ms === 0;
  const urgent = ms <= 2 * 60_000;
  const milestone = expired
    ? "Reservation expired"
    : ms <= 60_000
      ? "Less than 1 minute left"
      : ms <= 5 * 60_000
        ? "Less than 5 minutes left"
        : "";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm ${urgent ? "text-destructive" : "text-foreground"}`}
    >
      <Clock size={16} aria-hidden="true" />
      {expired ? (
        <span className="font-medium">Reservation expired</span>
      ) : (
        <span>
          {label}{" "}
          <span role="timer" className="font-semibold tabular-nums">
            {formatRemaining(ms)}
          </span>
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {milestone}
      </span>
    </div>
  );
}
