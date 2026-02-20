import type { TimeEntryData, BudgetData } from "./types";

/** Budget variance in hours (positive = over budget) */
export function calculateBudgetVarianceHours(
  entries: TimeEntryData[],
  budget: BudgetData
): number {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  return totalHours - budget.hours;
}

/** Budget variance in amount (positive = over budget revenue) */
export function calculateBudgetVarianceAmount(
  entries: TimeEntryData[],
  budget: BudgetData
): number {
  const totalRevenue = entries.reduce((sum, e) => sum + e.calculatedPrice, 0);
  return totalRevenue - budget.amount;
}

/** Budget deviation as percentage (0.1 = 10% over) */
export function calculateBudgetDeviationPercent(
  actual: number,
  budget: number
): number {
  if (budget === 0) return 0;
  return (actual - budget) / budget;
}

/** "Kunde ha debiterat löpande" — diff between calculated price and running price */
export function calculateCouldHaveBilledDiff(entries: TimeEntryData[]): number {
  return entries.reduce((sum, e) => {
    const running = e.runningPrice ?? e.calculatedPrice;
    return sum + (e.calculatedPrice - running);
  }, 0);
}
