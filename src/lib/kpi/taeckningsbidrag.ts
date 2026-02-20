import type { TimeEntryData } from "./types";

/** Täckningsbidrag = Intäkt - Kostnad */
export function calculateTB(entries: TimeEntryData[]): number {
  const revenue = entries.reduce((sum, e) => sum + e.calculatedPrice, 0);
  const cost = entries.reduce((sum, e) => sum + e.costAmount, 0);
  return revenue - cost;
}

/** TB per entry */
export function calculateEntryTB(entry: TimeEntryData): number {
  return entry.calculatedPrice - entry.costAmount;
}

/** Total revenue */
export function calculateTotalRevenue(entries: TimeEntryData[]): number {
  return entries.reduce((sum, e) => sum + e.calculatedPrice, 0);
}

/** Total cost */
export function calculateTotalCost(entries: TimeEntryData[]): number {
  return entries.reduce((sum, e) => sum + e.costAmount, 0);
}
