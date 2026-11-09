import Big from "big.js";

export const RATE_PATTERN = /^\d{1,2}(\.\d)?$/;

/** Commission rate rule shared with the mock: 0–30 %, at most one decimal. */
export function rateError(value: string) {
  if (!RATE_PATTERN.test(value.trim()))
    return "Enter a number from 0 to 30 with at most one decimal, e.g. 5.5.";
  if (new Big(value).gt(30)) return "Commission cannot be higher than 30%.";
  return undefined;
}

export function normalizeRate(value: string) {
  return RATE_PATTERN.test(value.trim()) ? new Big(value).toFixed(1) : value;
}
