import { describe, it, expect } from "vitest";
import { calculateDebitableHours, calculateTotalHours, calculateAvailableHours, calculateUtilization } from "@/lib/kpi/belaggning";
import type { TimeEntryData, CapacityData } from "@/lib/kpi/types";

const makeEntry = (overrides: Partial<TimeEntryData> = {}): TimeEntryData => ({
  hours: 8,
  calculatedPrice: 9600,
  costAmount: 3600,
  articleGroupType: "ORDINARIE",
  ...overrides,
});

describe("Beläggning", () => {
  it("excludes INTERNTID from debitable hours", () => {
    const entries = [
      makeEntry({ hours: 6, articleGroupType: "ORDINARIE" }),
      makeEntry({ hours: 2, articleGroupType: "INTERNTID" }),
    ];
    expect(calculateDebitableHours(entries)).toBe(6);
    expect(calculateTotalHours(entries)).toBe(8);
  });

  it("calculates available hours", () => {
    const capacity: CapacityData = { totalWorkingHours: 160, absenceHours: 16 };
    expect(calculateAvailableHours(capacity)).toBe(144);
  });

  it("calculates utilization", () => {
    const entries = [makeEntry({ hours: 120, articleGroupType: "ORDINARIE" })];
    const capacity: CapacityData = { totalWorkingHours: 160, absenceHours: 0 };
    expect(calculateUtilization(entries, capacity)).toBeCloseTo(0.75, 5);
  });

  it("returns 0 utilization when no available hours", () => {
    const entries = [makeEntry({ hours: 8 })];
    const capacity: CapacityData = { totalWorkingHours: 0, absenceHours: 0 };
    expect(calculateUtilization(entries, capacity)).toBe(0);
  });
});
