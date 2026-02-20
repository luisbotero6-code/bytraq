import { describe, it, expect } from "vitest";
import { calculateTGPercent, calculateTGPercentForGroup } from "@/lib/kpi/taeckningsgrad";
import type { TimeEntryData } from "@/lib/kpi/types";

const makeEntry = (overrides: Partial<TimeEntryData> = {}): TimeEntryData => ({
  hours: 8,
  calculatedPrice: 10000,
  costAmount: 4000,
  articleGroupType: "ORDINARIE",
  ...overrides,
});

describe("Täckningsgrad", () => {
  it("calculates TG% correctly", () => {
    const entries = [makeEntry({ calculatedPrice: 10000, costAmount: 4000 })];
    expect(calculateTGPercent(entries)).toBeCloseTo(0.6, 5);
  });

  it("returns 0 when no revenue", () => {
    expect(calculateTGPercent([])).toBe(0);
    expect(calculateTGPercent([makeEntry({ calculatedPrice: 0, costAmount: 0 })])).toBe(0);
  });

  it("calculates per-group TG%", () => {
    const groups = {
      "customer-a": [makeEntry({ calculatedPrice: 10000, costAmount: 2000 })],
      "customer-b": [makeEntry({ calculatedPrice: 5000, costAmount: 4000 })],
    };
    const result = calculateTGPercentForGroup(groups);
    expect(result["customer-a"]).toBeCloseTo(0.8, 5);
    expect(result["customer-b"]).toBeCloseTo(0.2, 5);
  });
});
