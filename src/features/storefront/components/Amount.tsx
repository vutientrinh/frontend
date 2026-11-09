import { MoneyText } from "../../../components/shared";
import { cn } from "../../../lib/utils";
import type { Money as MoneyValue } from "../../commerce/types";

/**
 * The storefront's single money adapter over the shared `MoneyText` (DESIGN.md §1, ledger numerals).
 * It adds the one storefront-only tone: `deal`, for a sale price (MoneyText has no deal tone because
 * the seller portal, admin and wallet must not use it). `success` is only for money coming back.
 * A reduction (voucher, savings) uses `sign="minus"`: U+2212 in foreground, never red.
 */
export function Amount({
  amount,
  tone = "default",
  sign,
  className,
}: {
  amount: MoneyValue;
  tone?: "default" | "deal" | "success" | "muted";
  sign?: "minus" | "plus";
  className?: string;
}) {
  const money = (
    <MoneyText
      amount={amount}
      sign={sign}
      tone={tone === "deal" ? "default" : tone}
    />
  );
  if (tone !== "deal" && !className) return money;
  return (
    <span className={cn(tone === "deal" && "text-deal", className)}>
      {money}
    </span>
  );
}
