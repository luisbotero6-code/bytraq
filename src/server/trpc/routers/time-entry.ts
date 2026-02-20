import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";
import { TRPCError } from "@trpc/server";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";

export const timeEntryRouter = router({
  getWeek: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      weekStart: z.string(), // ISO date string (Monday)
    }))
    .query(async ({ ctx, input }) => {
      const start = new Date(input.weekStart);
      const end = endOfWeek(start, { weekStartsOn: 1 });

      return ctx.db.timeEntry.findMany({
        where: {
          employeeId: input.employeeId,
          date: { gte: start, lte: end },
        },
        include: { customer: true, article: true, pricingRule: true },
        orderBy: [{ customerId: "asc" }, { articleId: "asc" }, { date: "asc" }],
      });
    }),

  getDay: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.timeEntry.findMany({
        where: {
          employeeId: input.employeeId,
          date: new Date(input.date),
        },
        include: { customer: true, article: true, pricingRule: true },
        orderBy: { createdAt: "asc" },
      });
    }),

  upsert: protectedProcedure
    .input(z.object({
      id: z.string().optional(),
      employeeId: z.string(),
      customerId: z.string(),
      articleId: z.string(),
      date: z.string(),
      hours: z.number().min(0).max(24),
      comment: z.string().optional().nullable(),
      invoiceText: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = new Date(input.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Check period lock
      const lock = await ctx.db.periodLock.findUnique({
        where: { year_month: { year, month } },
      });
      if (lock && !lock.unlockedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Perioden är låst" });
      }

      // Get employee for cost calculation
      const employee = await ctx.db.employee.findUniqueOrThrow({
        where: { id: input.employeeId },
      });

      // Calculate cost from history or current
      const costHistory = await ctx.db.employeeCostHistory.findFirst({
        where: {
          employeeId: input.employeeId,
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      const costPerHour = costHistory?.costPerHour ?? employee.costPerHour;
      const costAmount = Number(costPerHour) * input.hours;

      // Find applicable pricing rule
      const pricingRules = await ctx.db.pricingRule.findMany({
        where: {
          active: true,
          OR: [{ validFrom: null }, { validFrom: { lte: date } }],
          AND: [
            { OR: [{ validTo: null }, { validTo: { gte: date } }] },
          ],
        },
        orderBy: { priority: "desc" },
      });

      // Priority-based rule resolution
      let applicableRule = pricingRules.find(r =>
        r.scope === "CUSTOMER_ARTICLE" && r.customerId === input.customerId && r.articleId === input.articleId
      ) ?? pricingRules.find(r =>
        r.scope === "CUSTOMER" && r.customerId === input.customerId
      ) ?? pricingRules.find(r => {
        if (r.scope !== "ARTICLE") return false;
        return r.articleId === input.articleId;
      }) ?? pricingRules.find(r => r.scope === "GLOBAL");

      let calculatedPrice = Number(employee.defaultPricePerHour) * input.hours;
      if (applicableRule) {
        if (applicableRule.pricePerHour) {
          calculatedPrice = Number(applicableRule.pricePerHour) * input.hours;
        }
        if (applicableRule.fixedPriceComponent) {
          calculatedPrice += Number(applicableRule.fixedPriceComponent);
        }
        if (applicableRule.markup) {
          calculatedPrice *= (1 + Number(applicableRule.markup));
        }
        if (applicableRule.discount) {
          calculatedPrice *= (1 - Number(applicableRule.discount));
        }
        if (applicableRule.minimumCharge && calculatedPrice < Number(applicableRule.minimumCharge)) {
          calculatedPrice = Number(applicableRule.minimumCharge);
        }
      }

      const data = {
        employeeId: input.employeeId,
        customerId: input.customerId,
        articleId: input.articleId,
        date,
        hours: input.hours,
        comment: input.comment ?? null,
        invoiceText: input.invoiceText ?? null,
        costAmount,
        calculatedPrice,
        pricingRuleId: applicableRule?.id ?? null,
      };

      if (input.id) {
        return ctx.db.timeEntry.update({ where: { id: input.id }, data });
      }

      return ctx.db.timeEntry.create({ data });
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUniqueOrThrow({ where: { id: input } });
      const year = entry.date.getFullYear();
      const month = entry.date.getMonth() + 1;

      const lock = await ctx.db.periodLock.findUnique({
        where: { year_month: { year, month } },
      });
      if (lock && !lock.unlockedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Perioden är låst" });
      }

      return ctx.db.timeEntry.delete({ where: { id: input } });
    }),

  copyPreviousWeek: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      targetWeekStart: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const targetStart = new Date(input.targetWeekStart);
      const prevStart = addDays(targetStart, -7);
      const prevEnd = addDays(prevStart, 6);

      const prevEntries = await ctx.db.timeEntry.findMany({
        where: {
          employeeId: input.employeeId,
          date: { gte: prevStart, lte: prevEnd },
        },
      });

      const newEntries = prevEntries.map(entry => ({
        employeeId: entry.employeeId,
        customerId: entry.customerId,
        articleId: entry.articleId,
        date: addDays(entry.date, 7),
        hours: entry.hours,
        comment: entry.comment,
        invoiceText: entry.invoiceText,
        costAmount: entry.costAmount,
        calculatedPrice: entry.calculatedPrice,
        pricingRuleId: entry.pricingRuleId,
      }));

      return ctx.db.timeEntry.createMany({ data: newEntries });
    }),
});
