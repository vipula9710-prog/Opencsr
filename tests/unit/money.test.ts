import { describe, expect, it } from "vitest";
import { compareMoney, formatMoney, fromMinor, percentOf, subtractMoney, sumMoney, toMinor } from "@/lib/money";

describe("money", () => {
  it("adds decimals without floating point error", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney(["1000000.01", "2.99", 3])).toBe("1000006.00");
  });
  it("subtracts and compares", () => {
    expect(subtractMoney("100.00", "0.01")).toBe("99.99");
    expect(compareMoney("10", "10.00")).toBe(0);
    expect(compareMoney("10.01", "10")).toBe(1);
  });
  it("converts minor units", () => {
    expect(toMinor("12.345")).toBe(1235n);
    expect(fromMinor(-1050n)).toBe("-10.50");
  });
  it("computes percentages safely", () => {
    expect(percentOf("25", "100")).toBe(25);
    expect(percentOf("1", "0")).toBe(0);
  });
  it("rejects invalid input", () => {
    expect(() => toMinor("12,50")).toThrow();
  });
  it("formats currency", () => {
    expect(formatMoney("1500000", "INR", "en-IN")).toContain("15,00,000");
  });
});
