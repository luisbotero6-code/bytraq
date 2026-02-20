import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const pricingRouter = router({
  list: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .query(async ({ ctx }) => {
      return ctx.db.pricingRule.findMany({
        include: { customer: true, article: true, articleGroup: true },
        orderBy: [{ priority: "desc" }, { scope: "asc" }],
      });
    }),

  create: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      name: z.string().min(1),
      scope: z.enum(["GLOBAL", "ARTICLE_GROUP", "ARTICLE", "CUSTOMER", "CUSTOMER_ARTICLE"]),
      priority: z.number().int(),
      pricePerHour: z.number().optional().nullable(),
      fixedPriceComponent: z.number().optional().nullable(),
      markup: z.number().optional().nullable(),
      discount: z.number().optional().nullable(),
      minimumCharge: z.number().optional().nullable(),
      validFrom: z.string().optional().nullable(),
      validTo: z.string().optional().nullable(),
      articleGroupId: z.string().optional().nullable(),
      articleId: z.string().optional().nullable(),
      customerId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { validFrom, validTo, ...rest } = input;
      return ctx.db.pricingRule.create({
        data: {
          ...rest,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
        },
      });
    }),

  update: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      priority: z.number().int().optional(),
      pricePerHour: z.number().optional().nullable(),
      fixedPriceComponent: z.number().optional().nullable(),
      markup: z.number().optional().nullable(),
      discount: z.number().optional().nullable(),
      minimumCharge: z.number().optional().nullable(),
      validFrom: z.string().optional().nullable(),
      validTo: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, validFrom, validTo, ...rest } = input;
      return ctx.db.pricingRule.update({
        where: { id },
        data: {
          ...rest,
          ...(validFrom !== undefined ? { validFrom: validFrom ? new Date(validFrom) : null } : {}),
          ...(validTo !== undefined ? { validTo: validTo ? new Date(validTo) : null } : {}),
        },
      });
    }),

  preview: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      articleId: z.string(),
      date: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const date = input.date ? new Date(input.date) : new Date();

      const rules = await ctx.db.pricingRule.findMany({
        where: {
          active: true,
          OR: [{ validFrom: null }, { validFrom: { lte: date } }],
        },
        include: { customer: true, article: true, articleGroup: true },
        orderBy: { priority: "desc" },
      });

      const article = await ctx.db.article.findUniqueOrThrow({
        where: { id: input.articleId },
        include: { articleGroup: true },
      });

      const applicable = rules.find(r =>
        r.scope === "CUSTOMER_ARTICLE" && r.customerId === input.customerId && r.articleId === input.articleId
      ) ?? rules.find(r =>
        r.scope === "CUSTOMER" && r.customerId === input.customerId
      ) ?? rules.find(r =>
        r.scope === "ARTICLE" && r.articleId === input.articleId
      ) ?? rules.find(r =>
        r.scope === "ARTICLE_GROUP" && r.articleGroupId === article.articleGroupId
      ) ?? rules.find(r => r.scope === "GLOBAL");

      return { rule: applicable, allMatchingRules: rules };
    }),
});
