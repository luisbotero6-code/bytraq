import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { budgetEffectiveAtWhere, deduplicateBudgetEntries } from "@/server/services/budget-query";

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
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

      const [timeEntries, budgetEntries, customer] = await Promise.all([
        ctx.db.timeEntry.findMany({
          where: { customerId: input.customerId, date: { gte: startDate, lte: endDate } },
          include: { article: { include: { articleGroup: true } }, employee: true },
        }),
        ctx.db.budgetEntry.findMany({
          where: budgetEffectiveAtWhere(input.year, input.month, { customerId: input.customerId }),
          include: { article: true },
        }).then(deduplicateBudgetEntries),
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

      for (const b of budgetEntries) {
        const existing = articleMap.get(b.articleId) ?? {
          articleName: b.article.name, hours: 0, revenue: 0, cost: 0, budgetHours: 0, budgetAmount: 0,
        };
        existing.budgetHours += Number(b.hours);
        existing.budgetAmount += Number(b.amount);
        articleMap.set(b.articleId, existing);
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
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

      const customers = await ctx.db.customer.findMany({
        where: { clientManagerId: input.clientManagerId, active: true },
      });

      const customerIds = customers.map(c => c.id);

      const [timeEntries, budgetEntries] = await Promise.all([
        ctx.db.timeEntry.findMany({
          where: { customerId: { in: customerIds }, date: { gte: startDate, lte: endDate } },
        }),
        ctx.db.budgetEntry.findMany({
          where: budgetEffectiveAtWhere(input.year, input.month, { customerId: { in: customerIds } }),
        }).then(deduplicateBudgetEntries),
      ]);

      return customers.map(c => {
        const cTime = timeEntries.filter(t => t.customerId === c.id);
        const cBudget = budgetEntries.filter(b => b.customerId === c.id);
        const revenue = cTime.reduce((s, e) => s + Number(e.calculatedPrice ?? 0), 0);
        const cost = cTime.reduce((s, e) => s + Number(e.costAmount ?? 0), 0);
        const hours = cTime.reduce((s, e) => s + Number(e.hours), 0);
        const budgetHours = cBudget.reduce((s, e) => s + Number(e.hours), 0);
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
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

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
});
