import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";
import { TRPCError } from "@trpc/server";
import { budgetEffectiveAtWhere, deduplicateBudgetEntries } from "@/server/services/budget-query";

export const budgetRouter = router({
  list: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (input.status === "DRAFT") {
        // Drafts: show exact period match
        return ctx.db.budgetEntry.findMany({
          where: {
            startYear: input.year,
            startMonth: input.month,
            status: "DRAFT",
          },
          include: { customer: true, article: true },
          orderBy: [{ customer: { name: "asc" } }, { article: { code: "asc" } }],
        });
      }

      if (input.status === "PUBLISHED") {
        // Published: show entries effective at this period
        const entries = await ctx.db.budgetEntry.findMany({
          where: budgetEffectiveAtWhere(input.year, input.month),
          include: { customer: true, article: true },
          orderBy: [{ customer: { name: "asc" } }, { article: { code: "asc" } }],
        });
        return deduplicateBudgetEntries(entries);
      }

      // No status filter: return both drafts (exact match) and published (effective)
      const [drafts, published] = await Promise.all([
        ctx.db.budgetEntry.findMany({
          where: {
            startYear: input.year,
            startMonth: input.month,
            status: "DRAFT",
          },
          include: { customer: true, article: true },
          orderBy: [{ customer: { name: "asc" } }, { article: { code: "asc" } }],
        }),
        ctx.db.budgetEntry.findMany({
          where: budgetEffectiveAtWhere(input.year, input.month),
          include: { customer: true, article: true },
          orderBy: [{ customer: { name: "asc" } }, { article: { code: "asc" } }],
        }),
      ]);

      return [...drafts, ...deduplicateBudgetEntries(published)];
    }),

  upsert: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING", "TEAM_LEAD"))
    .input(z.object({
      id: z.string().optional(),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      customerId: z.string(),
      articleId: z.string(),
      hours: z.number().min(0),
      amount: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        return ctx.db.budgetEntry.update({
          where: { id: input.id },
          data: { hours: input.hours, amount: input.amount },
        });
      }

      return ctx.db.budgetEntry.create({
        data: {
          startYear: input.startYear,
          startMonth: input.startMonth,
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
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const drafts = await tx.budgetEntry.findMany({
          where: { startYear: input.startYear, startMonth: input.startMonth, status: "DRAFT" },
        });

        if (drafts.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Inga utkast att publicera" });
        }

        // Get current max version
        const maxVersion = await tx.budgetEntry.aggregate({
          where: { startYear: input.startYear, startMonth: input.startMonth, status: "PUBLISHED" },
          _max: { version: true },
        });
        const nextVersion = (maxVersion._max.version ?? 0) + 1;

        // Auto-close open PUBLISHED entries for the same customer+article combos
        const endMonth = input.startMonth === 1 ? 12 : input.startMonth - 1;
        const endYear = input.startMonth === 1 ? input.startYear - 1 : input.startYear;

        for (const draft of drafts) {
          await tx.budgetEntry.updateMany({
            where: {
              customerId: draft.customerId,
              articleId: draft.articleId,
              status: "PUBLISHED",
              endYear: null,
            },
            data: { endYear, endMonth },
          });
        }

        // Update drafts → published
        await tx.budgetEntry.updateMany({
          where: { startYear: input.startYear, startMonth: input.startMonth, status: "DRAFT" },
          data: { status: "PUBLISHED", version: nextVersion },
        });

        return { published: drafts.length, version: nextVersion };
      });
    }),

  endBudget: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      customerId: z.string(),
      endYear: z.number(),
      endMonth: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.budgetEntry.updateMany({
        where: {
          customerId: input.customerId,
          status: "PUBLISHED",
          endYear: null,
        },
        data: {
          endYear: input.endYear,
          endMonth: input.endMonth,
        },
      });

      return { closed: result.count };
    }),

  history: protectedProcedure
    .input(z.object({
      customerId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.budgetEntry.findMany({
        where: {
          customerId: input.customerId,
          status: "PUBLISHED",
        },
        include: { article: true },
        orderBy: [{ startYear: "desc" }, { startMonth: "desc" }, { article: { code: "asc" } }],
      });
    }),

  delete: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING", "TEAM_LEAD"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.budgetEntry.delete({ where: { id: input.id } });
    }),

  deleteByCustomer: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      customerId: z.string(),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const where: { customerId: string; startYear: number; startMonth: number; status?: "DRAFT" | "PUBLISHED" } = {
        customerId: input.customerId,
        startYear: input.startYear,
        startMonth: input.startMonth,
      };
      if (input.status) where.status = input.status;
      const result = await ctx.db.budgetEntry.deleteMany({ where });
      return { deleted: result.count };
    }),

  importBulk: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      rows: z.array(z.object({
        customerNumber: z.string(),
        articleCode: z.string(),
        hours: z.number().min(0),
        amount: z.number().min(0),
        startYear: z.number(),
        startMonth: z.number().min(1).max(12),
        endYear: z.number().nullable(),
        endMonth: z.number().min(1).max(12).nullable(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Build customer number → id map
      const customers = await ctx.db.customer.findMany({ where: { active: true } });
      const customerMap = new Map<string, string>();
      for (const c of customers) {
        if (c.customerNumber) customerMap.set(c.customerNumber, c.id);
      }

      // Build article code → id map (case-insensitive)
      const articles = await ctx.db.article.findMany({ where: { active: true } });
      const articleMap = new Map<string, string>();
      for (const a of articles) {
        articleMap.set(a.code.toLowerCase(), a.id);
      }

      const data: {
        startYear: number; startMonth: number;
        endYear: number | null; endMonth: number | null;
        customerId: string; articleId: string;
        hours: number; amount: number;
        status: "PUBLISHED"; version: number;
      }[] = [];
      const skippedCustomers = new Set<string>();
      const skippedArticles = new Set<string>();

      for (const row of input.rows) {
        const customerId = customerMap.get(row.customerNumber);
        if (!customerId) { skippedCustomers.add(row.customerNumber); continue; }
        const articleId = articleMap.get(row.articleCode.toLowerCase());
        if (!articleId) { skippedArticles.add(row.articleCode); continue; }

        data.push({
          startYear: row.startYear,
          startMonth: row.startMonth,
          endYear: row.endYear,
          endMonth: row.endMonth,
          customerId,
          articleId,
          hours: row.hours,
          amount: row.amount,
          status: "PUBLISHED",
          version: 1,
        });
      }

      if (data.length > 0) {
        await ctx.db.budgetEntry.createMany({ data, skipDuplicates: true });
      }

      return {
        count: data.length,
        skippedCustomers: Array.from(skippedCustomers),
        skippedArticles: Array.from(skippedArticles),
      };
    }),

  importFile: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING", "TEAM_LEAD"))
    .input(z.object({
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      customerId: z.string(),
      rows: z.array(z.object({
        articleCode: z.string(),
        hours: z.number().min(0),
        amount: z.number().min(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Build article code → id map (case-insensitive)
      const articles = await ctx.db.article.findMany({ where: { active: true } });
      const articleMap = new Map<string, string>();
      for (const a of articles) {
        articleMap.set(a.code.toLowerCase(), a.id);
      }

      const data: { startYear: number; startMonth: number; customerId: string; articleId: string; hours: number; amount: number; status: "DRAFT" }[] = [];
      const skipped: string[] = [];

      for (const row of input.rows) {
        const articleId = articleMap.get(row.articleCode.toLowerCase());
        if (!articleId) {
          skipped.push(row.articleCode);
          continue;
        }
        data.push({
          startYear: input.startYear,
          startMonth: input.startMonth,
          customerId: input.customerId,
          articleId,
          hours: row.hours,
          amount: row.amount,
          status: "DRAFT",
        });
      }

      if (data.length > 0) {
        await ctx.db.budgetEntry.createMany({ data, skipDuplicates: true });
      }

      return { count: data.length, skipped };
    }),
});
