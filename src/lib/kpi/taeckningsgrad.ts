import type { TimeEntryData } from "./types";
import { calculateTB, calculateTotalRevenue } from "./taeckningsbidrag";

/** Täckningsgrad = TB / Intäkt (0-1 fraction) */
export function calculateTGPercent(entries: TimeEntryData[]): number {
  const revenue = calculateTotalRevenue(entries);
  if (revenue === 0) return 0;
  return calculateTB(entries) / revenue;
}

/** TG% per customer grouping */
export function calculateTGPercentForGroup(
  groups: Record<string, TimeEntryData[]>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, entries] of Object.entries(groups)) {
    result[key] = calculateTGPercent(entries);
  }
  return result;
}
