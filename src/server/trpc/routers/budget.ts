import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";
import { TRPCError } from "@trpc/server";

export const budgetRouter = router({
  list: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.budgetEntry.findMany({
        where: {
          year: input.year,
          month: input.month,
          ...(input.status ? { status: input.status } : {}),
        },
        include: { customer: true, article: true },
        orderBy: [{ customer: { name: "asc" } }, { article: { code: "asc" } }],
      });
    }),

  upsert: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING", "TEAM_LEAD"))
    .input(z.object({
      id: z.string().optional(),
      year: z.number(),
      month: z.number().min(1).max(12),
      customerId: z.string(),
      articleId: z.string(),
      hours: z.number().min(0),
      amount: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check period lock
      const lock = await ctx.db.periodLock.findUnique({
        where: { year_month: { year: input.year, month: input.month } },
      });
      if (lock && !lock.unlockedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Perioden är låst" });
      }

      if (input.id) {
        return ctx.db.budgetEntry.update({
          where: { id: input.id },
          data: { hours: input.hours, amount: input.amount },
        });
      }

      return ctx.db.budgetEntry.create({
        data: {
          year: input.year,
          month: input.month,
          customerId: input.customerId,
          articleId: input.articleId,
          hours: input.hours,
          amount: input.amount,
          status: "DRAFT",
        },
      });
    }),

  publish: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const drafts = await tx.budgetEntry.findMany({
          where: { year: input.year, month: input.month, status: "DRAFT" },
        });

        if (drafts.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Inga utkast att publicera" });
        }

        // Get current max version for published entries
        const maxVersion = await tx.budgetEntry.aggregate({
          where: { year: input.year, month: input.month, status: "PUBLISHED" },
          _max: { version: true },
        });
        const nextVersion = (maxVersion._max.version ?? 0) + 1;

        // Update all drafts to published
        await tx.budgetEntry.updateMany({
          where: { year: input.year, month: input.month, status: "DRAFT" },
          data: { status: "PUBLISHED", version: nextVersion },
        });

        return { published: drafts.length, version: nextVersion };
      });
    }),

  copyFromPreviousMonth: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING", "TEAM_LEAD"))
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      const prevMonth = input.month === 1 ? 12 : input.month - 1;
      const prevYear = input.month === 1 ? input.year - 1 : input.year;

      const prevEntries = await ctx.db.budgetEntry.findMany({
        where: { year: prevYear, month: prevMonth, status: "PUBLISHED" },
      });

      if (prevEntries.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ingen publicerad budget att kopiera" });
      }

      const newEntries = prevEntries.map(e => ({
        year: input.year,
        month: input.month,
        customerId: e.customerId,
        articleId: e.articleId,
        hours: e.hours,
        amount: e.amount,
        status: "DRAFT" as const,
      }));

      return ctx.db.budgetEntry.createMany({ data: newEntries, skipDuplicates: true });
    }),
});
