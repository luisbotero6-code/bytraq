import type { Prisma, PrismaClient } from "@/generated/prisma";

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
/**
 * Return a list of {year, month} objects for every month in the inclusive range.
 */
export function monthsInRange(
  startY: number,
  startM: number,
  endY: number,
  endM: number,
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    result.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}

/**
 * Aggregate budget entries across a range of months.
 * Returns a Map keyed by "customerId:articleId" with summed hours/amount
 * across all months in the range (budget is a monthly allocation).
 */
export async function aggregateBudgetsForRange(
  db: PrismaClient,
  startY: number,
  startM: number,
  endY: number,
  endM: number,
  extra?: Prisma.BudgetEntryWhereInput,
): Promise<Map<string, { customerId: string; articleId: string; hours: number; amount: number }>> {
  const months = monthsInRange(startY, startM, endY, endM);
  const aggregated = new Map<string, { customerId: string; articleId: string; hours: number; amount: number }>();

  for (const { year, month } of months) {
    const entries = await db.budgetEntry.findMany({
      where: budgetEffectiveAtWhere(year, month, extra),
    });
    const deduped = deduplicateBudgetEntries(entries);

    for (const entry of deduped) {
      const key = `${entry.customerId}:${entry.articleId}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.hours += Number(entry.hours);
        existing.amount += Number(entry.amount);
      } else {
        aggregated.set(key, {
          customerId: entry.customerId,
          articleId: entry.articleId,
          hours: Number(entry.hours),
          amount: Number(entry.amount),
        });
      }
    }
  }

  return aggregated;
}

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
