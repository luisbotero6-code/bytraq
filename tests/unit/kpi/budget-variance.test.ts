import { describe, it, expect } from "vitest";
import { calculateBudgetVarianceHours, calculateBudgetVarianceAmount, calculateBudgetDeviationPercent, calculateCouldHaveBilledDiff } from "@/lib/kpi/budget-variance";
import type { TimeEntryData, BudgetData } from "@/lib/kpi/types";

const makeEntry = (overrides: Partial<TimeEntryData> = {}): TimeEntryData => ({
  hours: 8,
  calculatedPrice: 9600,
  costAmount: 3600,
  articleGroupType: "ORDINARIE",
  ...overrides,
});

describe("Budget variance", () => {
  it("calculates hours variance (over budget)", () => {
    const entries = [makeEntry({ hours: 50 })];
    const budget: BudgetData = { hours: 40, amount: 48000 };
    expect(calculateBudgetVarianceHours(entries, budget)).toBe(10);
  });

  it("calculates amount variance", () => {
    const entries = [makeEntry({ calculatedPrice: 60000 })];
    const budget: BudgetData = { hours: 40, amount: 48000 };
    expect(calculateBudgetVarianceAmount(entries, budget)).toBe(12000);
  });

  it("calculates deviation percent", () => {
    expect(calculateBudgetDeviationPercent(44, 40)).toBeCloseTo(0.1, 5);
    expect(calculateBudgetDeviationPercent(40, 40)).toBe(0);
    expect(calculateBudgetDeviationPercent(30, 40)).toBeCloseTo(-0.25, 5);
  });

  it("returns 0 deviation when budget is 0", () => {
    expect(calculateBudgetDeviationPercent(100, 0)).toBe(0);
  });

  it("calculates could-have-billed diff", () => {
    const entries = [
      makeEntry({ calculatedPrice: 12000, runningPrice: 9600 }),
      makeEntry({ calculatedPrice: 8000, runningPrice: 8000 }),
    ];
    expect(calculateCouldHaveBilledDiff(entries)).toBe(2400);
  });

  it("uses calculatedPrice as fallback for runningPrice", () => {
    const entries = [makeEntry({ calculatedPrice: 9600, runningPrice: undefined })];
    expect(calculateCouldHaveBilledDiff(entries)).toBe(0);
  });
});
