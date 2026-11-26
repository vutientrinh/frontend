import { useEffect, useState } from "react";
import { formatMoney } from "../../lib/money";
import { useInventory } from "../commerce/api";

/** G5: a variant (or a product's total) is low on stock at this many units or fewer. */
export const LOW_STOCK_MAX = 5;
export const LOW_STOCK_RULE = `Low stock means ${LOW_STOCK_MAX} or fewer available.`;
/** G5: a paid order has to be confirmed within 24 hours. */
export const CONFIRM_SLA_MS = 24 * 60 * 60 * 1000;
/** Largest page the API serves; used for one-request tab counts. */
export const COUNT_PAGE_SIZE = 100;

export function deadlineText(dueMs: number, nowMs: number) {
  const minutes = Math.ceil(Math.abs(dueMs - nowMs) / 60000);
  const text =
    minutes >= 1440
      ? `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`
      : minutes >= 60
        ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
        : `${minutes} min`;
  return dueMs < nowMs ? `Overdue by ${text}` : `${text} left`;
}

/** "Net 126,166,950₫": the ₫ trails the number, as `MoneyText` shows it. */
export function netText(amount: string) {
  return `Net ${formatMoney(amount, "VND").replace("₫", "").trim()}₫`;
}

/** Current time, refreshed every minute (deadline texts). */
export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Number of low-stock variants, counted from the inventory list so the dashboard, the bell and
 * the inventory page use the same rule. `undefined` while loading.
 */
export function useLowStockCount() {
  const inventory = useInventory();
  return inventory.data?.filter((row) => row.available <= LOW_STOCK_MAX).length;
}

/** Counts per tab, or none when the single request did not return every row. */
export function countsIfComplete<T>(
  result: { content: T[]; totalElements: number } | undefined,
) {
  return result && result.totalElements <= result.content.length
    ? result.content
    : undefined;
}
