import type { Prisma } from "@/generated/prisma";

/**
 * Build a Prisma where clause for budget entries effective at a given year/month.
 * A PUBLISHED entry is effective if:
 *   - startYear/startMonth <= target year/month
 *   - endYear/endMonth is NULL (ongoing) or >= target year/month
 */
export function budgetEffectiveAtWhere(
  year: number,
  month: number,
  extra?: Prisma.BudgetEntryWhereInput,
): Prisma.BudgetEntryWhereInput {
  return {
    status: "PUBLISHED",
    // start <= target
    OR: [
      { startYear: { lt: year } },
      { startYear: year, startMonth: { lte: month } },
    ],
    // end is null OR end >= target
    AND: [
      {
        OR: [
          { endYear: null },
          { endYear: { gt: year } },
          { endYear: year, endMonth: { gte: month } },
        ],
      },
      ...(extra ? [extra] : []),
    ],
  };
}

type BudgetLike = {
  customerId: string;
  articleId: string;
  startYear: number;
  startMonth: number;
  [key: string]: unknown;
};

/**
 * When multiple budget entries match for the same customer+article,
 * keep only the one with the latest startYear/startMonth.
 */
export function deduplicateBudgetEntries<T extends BudgetLike>(entries: T[]): T[] {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const key = `${entry.customerId}:${entry.articleId}`;
    const existing = map.get(key);
    if (
      !existing ||
      entry.startYear > existing.startYear ||
      (entry.startYear === existing.startYear && entry.startMonth > existing.startMonth)
    ) {
      map.set(key, entry);
    }
  }
  return Array.from(map.values());
}
