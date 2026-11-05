import { describe, expect, it } from "vitest";
import { formatMoney } from "../lib/money";
describe("formatMoney", () => {
  it("preserves large decimal strings", () =>
    expect(formatMoney("9007199254740993.1234", "USD")).toBe(
      "$9,007,199,254,740,993.1234",
    ));
  it("formats negative values", () =>
    expect(formatMoney("-1234.50", "USD")).toBe("-$1,234.50"));
  it("rejects invalid amounts", () =>
    expect(() => formatMoney("", "USD")).toThrow(RangeError));
  it("rejects invalid currencies", () =>
    expect(() => formatMoney("1", "bad currency")).toThrow(RangeError));
});
