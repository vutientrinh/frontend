export function formatMoney(amount: string, currency: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(amount))
    throw new RangeError("Invalid decimal amount");
  const currencyDigits =
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const fractionDigits = Math.max(
    (amount.split(".")[1] ?? "").length,
    currencyDigits,
  );
  if (fractionDigits > 20) throw new RangeError("Too many decimal places");
  // Intl accepts exact decimal strings; TypeScript's declaration omits them.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currencyDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount as unknown as number);
}
