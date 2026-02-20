import type { TimeEntryData, CapacityData } from "./types";

/** Debitable hours = all hours except INTERNTID */
export function calculateDebitableHours(entries: TimeEntryData[]): number {
  return entries
    .filter((e) => e.articleGroupType !== "INTERNTID")
    .reduce((sum, e) => sum + e.hours, 0);
}

/** Total hours */
export function calculateTotalHours(entries: TimeEntryData[]): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

/** Available hours = working hours - absence */
export function calculateAvailableHours(capacity: CapacityData): number {
  return capacity.totalWorkingHours - capacity.absenceHours;
}

/** Beläggningsgrad = Debiterbar tid / Tillgänglig tid */
export function calculateUtilization(
  entries: TimeEntryData[],
  capacity: CapacityData
): number {
  const available = calculateAvailableHours(capacity);
  if (available <= 0) return 0;
  return calculateDebitableHours(entries) / available;
}
