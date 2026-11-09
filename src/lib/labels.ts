export function humanLabel(value: string) {
  const labels: Record<string, string> = {
    CARD: "Card",
    BANK_TRANSFER: "Bank transfer",
    EWALLET: "E-wallet",
  };
  return (
    labels[value] ??
    value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}
