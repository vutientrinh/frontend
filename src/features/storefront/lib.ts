import Big from "big.js";
import { humanLabel } from "../../lib/labels";
import type {
  Money,
  OrderDetail,
  SellerOrderStatus,
  Variant,
} from "../commerce/types";

/** Whole-percent discount (rounded down so we never overstate it), or null when there is none. */
export function discountPercent(
  price: Money,
  compareAtPrice?: Money,
): number | null {
  if (!compareAtPrice) return null;
  const compare = new Big(compareAtPrice);
  const current = new Big(price);
  if (compare.lte(0) || compare.lte(current)) return null;
  const percent = compare
    .minus(current)
    .div(compare)
    .times(100)
    .round(0, Big.roundDown)
    .toNumber();
  return percent >= 1 ? percent : null;
}

export function lineTotal(unitPrice: Money, quantity: number): Money {
  return new Big(unitPrice).times(quantity).toFixed(0);
}

export function sumMoney(values: Money[]): Money {
  return values.reduce((sum, v) => sum.plus(v), new Big(0)).toFixed(0);
}

export function isPositive(value?: Money): value is Money {
  return !!value && new Big(value).gt(0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export type VariantSelection = Record<string, string>;
export type ProductOption = { name: string; values: string[] };

function matches(variant: Variant, selection: VariantSelection) {
  return Object.entries(selection).every(
    ([name, value]) => variant.options[name] === value,
  );
}

/** Selected values of the options that come before `index`. */
function earlierSelection(
  options: ProductOption[],
  selection: VariantSelection,
  index: number,
): VariantSelection {
  const result: VariantSelection = {};
  for (const option of options.slice(0, index))
    if (selection[option.name]) result[option.name] = selection[option.name];
  return result;
}

/**
 * Cascading availability: a value is available when some in-stock variant has it together with
 * the values already chosen for the options before it. Later options never block earlier ones,
 * so the shopper can always reach every in-stock combination.
 */
export function isOptionValueAvailable(
  variants: Variant[],
  options: ProductOption[],
  selection: VariantSelection,
  optionName: string,
  value: string,
) {
  const index = options.findIndex((o) => o.name === optionName);
  const probe = {
    ...earlierSelection(options, selection, index),
    [optionName]: value,
  };
  return variants.some((v) => v.stock > 0 && matches(v, probe));
}

/** Applies a choice and drops later choices that no longer have stock with it. */
export function selectOptionValue(
  variants: Variant[],
  options: ProductOption[],
  selection: VariantSelection,
  optionName: string,
  value: string,
): VariantSelection {
  const next: VariantSelection = { ...selection, [optionName]: value };
  const index = options.findIndex((o) => o.name === optionName);
  for (const option of options.slice(index + 1)) {
    const chosen = next[option.name];
    if (
      chosen &&
      !isOptionValueAvailable(variants, options, next, option.name, chosen)
    )
      delete next[option.name];
  }
  return next;
}

/** The variant for a complete selection, or undefined while an option is still unchosen. */
export function findVariant(
  variants: Variant[],
  options: ProductOption[],
  selection: VariantSelection,
): Variant | undefined {
  if (options.some((o) => !selection[o.name])) return undefined;
  return variants.find((v) => matches(v, selection));
}

/** Search filters. Values are strings so they map 1:1 to URL search params. */
export interface Facets {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
}

export function activeFacetCount(value: Facets) {
  return [
    value.category,
    value.minPrice || value.maxPrice,
    value.minRating,
  ].filter(Boolean).length;
}

export function formatRemaining(ms: number) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Product grid: 2 columns at 375px, then as many 176px+ columns as fit (no empty bands). */
export const productGridClass =
  "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] sm:gap-4";

/** "6 Nov 2026" in the shopper's locale (orders list and detail headers). */
export function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatOrderDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const PROGRESS_STEPS = [
  "Placed",
  "Paid",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Completed",
] as const;

/** Main-path step each status belongs to. PACKED is part of "Confirmed". */
const STEP_OF: Partial<Record<SellerOrderStatus, number>> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  CONFIRMED: 2,
  PACKED: 2,
  SHIPPED: 3,
  DELIVERED: 4,
  COMPLETED: 5,
};

/** Statuses that leave the main path; shown as the last step. */
const BRANCH_LABEL: Partial<Record<SellerOrderStatus, string>> = {
  CANCELLED: "Cancelled",
  DELIVERY_FAILED: "Delivery failed",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export interface ProgressStep {
  label: string;
  state: "done" | "current" | "todo" | "branch";
  at?: string;
}

/** Steps for the W-20 progress overview from the order status and its timeline. */
export function progressSteps(
  status: SellerOrderStatus,
  timeline: OrderDetail["timeline"],
): ProgressStep[] {
  const firstAt = (step: number) =>
    timeline.find((t) => STEP_OF[t.status] === step)?.at;
  const branch = BRANCH_LABEL[status];
  if (branch) {
    const reached = Math.max(
      0,
      ...timeline
        .map((t) => STEP_OF[t.status])
        .filter((s): s is number => s !== undefined),
    );
    const branchAt = [...timeline]
      .reverse()
      .find((t) => t.status === status)?.at;
    return [
      ...PROGRESS_STEPS.slice(0, reached + 1).map((label, i): ProgressStep => ({
        label,
        state: "done",
        at: firstAt(i),
      })),
      { label: branch, state: "branch", at: branchAt },
    ];
  }
  const current = STEP_OF[status] ?? 0;
  return PROGRESS_STEPS.map((label, i) => ({
    label,
    state:
      i < current || (i === current && status === "COMPLETED")
        ? "done"
        : i === current
          ? "current"
          : "todo",
    at: i <= current ? firstAt(i) : undefined,
  }));
}

export interface ActivityEntry {
  key: string;
  at: string;
  title: string;
  detail?: string;
  kind: "status" | "shipment";
}

/** Order status changes and carrier scans in one list, newest first. */
export function activityOf(o: OrderDetail): ActivityEntry[] {
  return [
    ...o.timeline.map((t, i): ActivityEntry => ({
      key: `s-${i}`,
      at: t.at,
      title: humanLabel(t.status),
      detail: t.note,
      kind: "status",
    })),
    ...(o.shipment?.events ?? []).map((e, i): ActivityEntry => ({
      key: `e-${i}`,
      at: e.at,
      title: humanLabel(e.status),
      detail: e.location,
      kind: "shipment",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

/** Horizontal strips: no native scrollbar, faded edges so it reads as "more to scroll". */
export const scrollStripClass =
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]";
