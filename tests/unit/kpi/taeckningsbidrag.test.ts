import { describe, it, expect } from "vitest";
import { calculateTB, calculateEntryTB, calculateTotalRevenue, calculateTotalCost } from "@/lib/kpi/taeckningsbidrag";
import type { TimeEntryData } from "@/lib/kpi/types";

const makeEntry = (overrides: Partial<TimeEntryData> = {}): TimeEntryData => ({
  hours: 8,
  calculatedPrice: 9600,
  costAmount: 3600,
  articleGroupType: "ORDINARIE",
  ...overrides,
});

describe("Täckningsbidrag", () => {
  it("calculates TB for single entry", () => {
    expect(calculateEntryTB(makeEntry())).toBe(6000);
  });

  it("calculates TB for multiple entries", () => {
    const entries = [
      makeEntry({ calculatedPrice: 9600, costAmount: 3600 }),
      makeEntry({ calculatedPrice: 4800, costAmount: 2000 }),
    ];
    expect(calculateTB(entries)).toBe(8800);
  });

  it("returns 0 for empty entries", () => {
    expect(calculateTB([])).toBe(0);
  });

  it("handles negative TB (loss)", () => {
    const entries = [makeEntry({ calculatedPrice: 1000, costAmount: 5000 })];
    expect(calculateTB(entries)).toBe(-4000);
  });

  it("calculates total revenue", () => {
    const entries = [makeEntry({ calculatedPrice: 1000 }), makeEntry({ calculatedPrice: 2000 })];
    expect(calculateTotalRevenue(entries)).toBe(3000);
  });

  it("calculates total cost", () => {
    const entries = [makeEntry({ costAmount: 400 }), makeEntry({ costAmount: 600 })];
    expect(calculateTotalCost(entries)).toBe(1000);
  });
});
