import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { budgetEffectiveAtWhere, deduplicateBudgetEntries, aggregateBudgetsForRange, monthsInRange } from "@/server/services/budget-query";

export const kpiRouter = router({
  dashboard: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
      employeeId: z.string().optional(),
      clientManagerId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

      const timeEntryWhere = {
        date: { gte: startDate, lte: endDate },
        ...(input.employeeId ? { employeeId: input.employeeId } : {}),
        ...(input.clientManagerId ? { customer: { clientManagerId: input.clientManagerId } } : {}),
      };

      const [timeEntries, budgetEntries, employees, absences, calendarDays] = await Promise.all([
        ctx.db.timeEntry.findMany({
          where: timeEntryWhere,
          include: { article: { include: { articleGroup: true } }, customer: true },
        }),
        ctx.db.budgetEntry.findMany({
          where: budgetEffectiveAtWhere(input.year, input.month),
        }).then(deduplicateBudgetEntries),
        ctx.db.employee.findMany({
          where: { active: true, ...(input.employeeId ? { id: input.employeeId } : {}) },
        }),
        ctx.db.absence.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          },
        }),
        ctx.db.calendarDay.findMany({
          where: { date: { gte: startDate, lte: endDate } },
        }),
      ]);

      const totalRevenue = timeEntries.reduce((sum, e) => sum + Number(e.calculatedPrice ?? 0), 0);
      const totalCost = timeEntries.reduce((sum, e) => sum + Number(e.costAmount ?? 0), 0);
      const totalHours = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0);
      const debitableHours = timeEntries
        .filter(e => e.article.articleGroup.type !== "INTERNTID")
        .reduce((sum, e) => sum + Number(e.hours), 0);

      const budgetHours = budgetEntries.reduce((sum, e) => sum + Number(e.hours), 0);
      const budgetAmount = budgetEntries.reduce((sum, e) => sum + Number(e.amount), 0);

      const workDays = calendarDays.filter(d => !d.isWeekend && !d.isHoliday).length || 22;
      const totalAbsenceHours = absences.reduce((sum, a) => sum + Number(a.hours), 0);

      const totalCapacityHours = employees.reduce((acc, e) => {
        return acc + (workDays * Number(e.weeklyHours) / 5);
      }, 0) - totalAbsenceHours;

      const tb = totalRevenue - totalCost;
      const tgPercent = totalRevenue > 0 ? tb / totalRevenue : 0;
      const utilization = totalCapacityHours > 0 ? debitableHours / totalCapacityHours : 0;

      return {
        totalRevenue,
        totalCost,
        tb,
        tgPercent,
        totalHours,
        debitableHours,
        utilization,
        totalCapacityHours,
        budgetHours,
        budgetAmount,
        budgetVarianceHours: totalHours - budgetHours,
        budgetVarianceAmount: totalRevenue - budgetAmount,
        employeeCount: employees.length,
      };
    }),

  customerReport: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      endYear: z.number(),
      endMonth: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startYear, input.startMonth - 1, 1);
      const endDate = new Date(input.endYear, input.endMonth, 0);

      const budgetMap = await aggregateBudgetsForRange(
        ctx.db,
        input.startYear, input.startMonth,
        input.endYear, input.endMonth,
        { customerId: input.customerId },
      );

      const [timeEntries, customer] = await Promise.all([
        ctx.db.timeEntry.findMany({
          where: { customerId: input.customerId, date: { gte: startDate, lte: endDate } },
          include: { article: { include: { articleGroup: true } }, employee: true },
        }),
        ctx.db.customer.findUniqueOrThrow({
          where: { id: input.customerId },
          include: { manager: true },
        }),
      ]);

      const articleMap = new Map<string, {
        articleName: string; hours: number; revenue: number; cost: number;
        budgetHours: number; budgetAmount: number;
      }>();

      for (const entry of timeEntries) {
        const existing = articleMap.get(entry.articleId) ?? {
          articleName: entry.article.name, hours: 0, revenue: 0, cost: 0, budgetHours: 0, budgetAmount: 0,
        };
        existing.hours += Number(entry.hours);
        existing.revenue += Number(entry.calculatedPrice ?? 0);
        existing.cost += Number(entry.costAmount ?? 0);
        articleMap.set(entry.articleId, existing);
      }

      // Merge aggregated budget data
      for (const [key, budget] of budgetMap) {
        if (budget.customerId !== input.customerId) continue;
        const existing = articleMap.get(budget.articleId);
        if (existing) {
          existing.budgetHours += budget.hours;
          existing.budgetAmount += budget.amount;
        } else {
          const article = await ctx.db.article.findUnique({ where: { id: budget.articleId } });
          if (!article) continue;
          articleMap.set(budget.articleId, {
            articleName: article.name, hours: 0, revenue: 0, cost: 0,
            budgetHours: budget.hours, budgetAmount: budget.amount,
          });
        }
      }

      const totalRevenue = timeEntries.reduce((s, e) => s + Number(e.calculatedPrice ?? 0), 0);
      const totalCost = timeEntries.reduce((s, e) => s + Number(e.costAmount ?? 0), 0);
      const couldHaveBilledDiff = timeEntries.reduce((s, e) =>
        s + Number(e.calculatedPrice ?? 0) - Number(e.runningPrice ?? e.calculatedPrice ?? 0), 0);

      return {
        customer,
        articles: Array.from(articleMap.entries()).map(([id, data]) => ({ articleId: id, ...data })),
        totals: {
          revenue: totalRevenue,
          cost: totalCost,
          tb: totalRevenue - totalCost,
          tgPercent: totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0,
          couldHaveBilledDiff,
        },
      };
    }),

  portfolio: protectedProcedure
    .input(z.object({
      clientManagerId: z.string(),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      endYear: z.number(),
      endMonth: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startYear, input.startMonth - 1, 1);
      const endDate = new Date(input.endYear, input.endMonth, 0);

      const customers = await ctx.db.customer.findMany({
        where: { clientManagerId: input.clientManagerId, active: true },
      });

      const customerIds = customers.map(c => c.id);

      const [timeEntries, budgetMap] = await Promise.all([
        ctx.db.timeEntry.findMany({
          where: { customerId: { in: customerIds }, date: { gte: startDate, lte: endDate } },
        }),
        aggregateBudgetsForRange(
          ctx.db,
          input.startYear, input.startMonth,
          input.endYear, input.endMonth,
          { customerId: { in: customerIds } },
        ),
      ]);

      return customers.map(c => {
        const cTime = timeEntries.filter(t => t.customerId === c.id);
        const revenue = cTime.reduce((s, e) => s + Number(e.calculatedPrice ?? 0), 0);
        const cost = cTime.reduce((s, e) => s + Number(e.costAmount ?? 0), 0);
        const hours = cTime.reduce((s, e) => s + Number(e.hours), 0);

        // Sum budget hours from aggregated budget map
        let budgetHours = 0;
        for (const [, b] of budgetMap) {
          if (b.customerId === c.id) budgetHours += b.hours;
        }

        const tb = revenue - cost;
        const tgPercent = revenue > 0 ? tb / revenue : 0;
        const budgetDeviation = budgetHours > 0 ? (hours - budgetHours) / budgetHours : 0;

        let status: "green" | "yellow" | "red" = "green";
        if (tgPercent < 0.2 || budgetDeviation > 0.25) status = "red";
        else if (tgPercent < 0.4 || budgetDeviation > 0.1) status = "yellow";

        return { customer: c, revenue, cost, tb, tgPercent, hours, budgetHours, budgetDeviation, status };
      });
    }),

  employeeReport: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      endYear: z.number(),
      endMonth: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startYear, input.startMonth - 1, 1);
      const endDate = new Date(input.endYear, input.endMonth, 0);

      const [employee, timeEntries, absences, calendarDays] = await Promise.all([
        ctx.db.employee.findUniqueOrThrow({ where: { id: input.employeeId } }),
        ctx.db.timeEntry.findMany({
          where: { employeeId: input.employeeId, date: { gte: startDate, lte: endDate } },
          include: { article: { include: { articleGroup: true } } },
        }),
        ctx.db.absence.findMany({
          where: { employeeId: input.employeeId, date: { gte: startDate, lte: endDate } },
        }),
        ctx.db.calendarDay.findMany({
          where: { date: { gte: startDate, lte: endDate } },
        }),
      ]);

      const workDays = calendarDays.filter(d => !d.isWeekend && !d.isHoliday).length;
      const capacityHours = workDays * Number(employee.weeklyHours) / 5;
      const absenceHours = absences.reduce((s, a) => s + Number(a.hours), 0);
      const availableHours = capacityHours - absenceHours;

      const totalHours = timeEntries.reduce((s, e) => s + Number(e.hours), 0);
      const debitableHours = timeEntries
        .filter(e => e.article.articleGroup.type !== "INTERNTID")
        .reduce((s, e) => s + Number(e.hours), 0);
      const nonDebitableHours = totalHours - debitableHours;

      return {
        employee,
        totalHours,
        debitableHours,
        nonDebitableHours,
        absenceHours,
        availableHours,
        utilization: availableHours > 0 ? debitableHours / availableHours : 0,
        targetUtilization: Number(employee.targetUtilization),
      };
    }),

  fixedPriceAnalysis: protectedProcedure
    .input(z.object({
      customerIds: z.array(z.string()),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      endYear: z.number(),
      endMonth: z.number().min(1).max(12),
      articleFilter: z.enum(["FIXED_PRICE", "TILLAGG", "ALL"]),
    }))
    .query(async ({ ctx, input }) => {
      // 1. Resolve customer list
      let customerIds = input.customerIds;
      if (customerIds.length === 0) {
        const customers = await ctx.db.customer.findMany({
          where: { customerType: { in: ["FASTPRIS", "BLANDAD"] }, active: true },
          select: { id: true },
        });
        customerIds = customers.map(c => c.id);
      }

      if (customerIds.length === 0) {
        return { rows: [], totals: { actualHours: 0, budgetHours: 0, varianceHours: 0, budgetAmount: 0, hourlyEquivalent: 0, actualCost: 0, tb: 0, tgPercent: 0 }, customerCount: 0, monthCount: 0 };
      }

      const startDate = new Date(input.startYear, input.startMonth - 1, 1);
      const endDate = new Date(input.endYear, input.endMonth, 0);
      const months = monthsInRange(input.startYear, input.startMonth, input.endYear, input.endMonth);

      // 2. Fetch time entries in range
      const timeEntries = await ctx.db.timeEntry.findMany({
        where: {
          customerId: { in: customerIds },
          date: { gte: startDate, lte: endDate },
        },
        include: {
          article: { include: { articleGroup: true } },
          employee: { select: { defaultPricePerHour: true } },
          customer: { select: { id: true, name: true } },
        },
      });

      // 3. Filter articles based on articleFilter
      const filteredEntries = timeEntries.filter(e => {
        if (input.articleFilter === "FIXED_PRICE") return e.article.includedInFixedPrice;
        if (input.articleFilter === "TILLAGG") return e.article.articleGroup.type === "TILLAGG";
        // ALL = both fixed price and tillägg
        return e.article.includedInFixedPrice || e.article.articleGroup.type === "TILLAGG";
      });

      // 4. Fetch aggregated budgets
      const budgetMap = await aggregateBudgetsForRange(
        ctx.db,
        input.startYear,
        input.startMonth,
        input.endYear,
        input.endMonth,
        { customerId: { in: customerIds } },
      );

      // 5. Build rows per customer+article
      const rowMap = new Map<string, {
        customerId: string;
        customerName: string;
        articleId: string;
        articleName: string;
        includedInFixedPrice: boolean;
        articleGroupType: string;
        actualHours: number;
        actualCost: number;
        hourlyEquivalent: number;
        budgetHours: number;
        budgetAmount: number;
      }>();

      for (const entry of filteredEntries) {
        const key = `${entry.customerId}:${entry.articleId}`;
        const existing = rowMap.get(key) ?? {
          customerId: entry.customerId,
          customerName: entry.customer.name,
          articleId: entry.articleId,
          articleName: entry.article.name,
          includedInFixedPrice: entry.article.includedInFixedPrice,
          articleGroupType: entry.article.articleGroup.type,
          actualHours: 0,
          actualCost: 0,
          hourlyEquivalent: 0,
          budgetHours: 0,
          budgetAmount: 0,
        };
        existing.actualHours += Number(entry.hours);
        existing.actualCost += Number(entry.costAmount ?? 0);
        existing.hourlyEquivalent += Number(entry.employee.defaultPricePerHour) * Number(entry.hours);
        rowMap.set(key, existing);
      }

      // Merge budget data into rows
      for (const [key, budget] of budgetMap) {
        // Check if this budget article passes the filter
        const existing = rowMap.get(key);
        if (existing) {
          existing.budgetHours = budget.hours;
          existing.budgetAmount = budget.amount;
        } else {
          // Budget exists but no time entries — need article info
          const article = await ctx.db.article.findUnique({
            where: { id: budget.articleId },
            include: { articleGroup: true },
          });
          if (!article) continue;

          // Apply filter
          if (input.articleFilter === "FIXED_PRICE" && !article.includedInFixedPrice) continue;
          if (input.articleFilter === "TILLAGG" && article.articleGroup.type !== "TILLAGG") continue;
          if (input.articleFilter === "ALL" && !article.includedInFixedPrice && article.articleGroup.type !== "TILLAGG") continue;

          // Only include if customer is in our list
          if (!customerIds.includes(budget.customerId)) continue;

          const customer = await ctx.db.customer.findUnique({
            where: { id: budget.customerId },
            select: { name: true },
          });

          rowMap.set(key, {
            customerId: budget.customerId,
            customerName: customer?.name ?? "",
            articleId: budget.articleId,
            articleName: article.name,
            includedInFixedPrice: article.includedInFixedPrice,
            articleGroupType: article.articleGroup.type,
            actualHours: 0,
            actualCost: 0,
            hourlyEquivalent: 0,
            budgetHours: budget.hours,
            budgetAmount: budget.amount,
          });
        }
      }

      // 6. Build final rows with calculated fields
      const rows = Array.from(rowMap.values()).map(r => {
        const varianceHours = r.actualHours - r.budgetHours;
        const tb = r.budgetAmount - r.actualCost;
        const tgPercent = r.budgetAmount > 0 ? tb / r.budgetAmount : 0;
        return {
          ...r,
          varianceHours,
          tb,
          tgPercent,
        };
      }).sort((a, b) => a.customerName.localeCompare(b.customerName, "sv") || a.articleName.localeCompare(b.articleName, "sv"));

      // 7. Calculate totals
      const totals = rows.reduce((acc, r) => ({
        actualHours: acc.actualHours + r.actualHours,
        budgetHours: acc.budgetHours + r.budgetHours,
        varianceHours: acc.varianceHours + r.varianceHours,
        budgetAmount: acc.budgetAmount + r.budgetAmount,
        hourlyEquivalent: acc.hourlyEquivalent + r.hourlyEquivalent,
        actualCost: acc.actualCost + r.actualCost,
        tb: acc.tb + r.tb,
        tgPercent: 0, // calculated below
      }), { actualHours: 0, budgetHours: 0, varianceHours: 0, budgetAmount: 0, hourlyEquivalent: 0, actualCost: 0, tb: 0, tgPercent: 0 });

      totals.tgPercent = totals.budgetAmount > 0 ? totals.tb / totals.budgetAmount : 0;

      return {
        rows,
        totals,
        customerCount: new Set(rows.map(r => r.customerId)).size,
        monthCount: months.length,
      };
    }),
});
