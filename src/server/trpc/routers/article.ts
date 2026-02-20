import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const articleRouter = router({
  list: protectedProcedure
    .input(z.object({ active: z.boolean().optional().default(true), groupId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.article.findMany({
        where: {
          active: input?.active ?? true,
          ...(input?.groupId ? { articleGroupId: input.groupId } : {}),
        },
        include: { articleGroup: true },
        orderBy: { code: "asc" },
      });
    }),

  groups: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.articleGroup.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { name: "asc" },
    });
  }),

  createGroup: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["ORDINARIE", "TILLAGG", "INTERNTID", "OVRIGT"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.articleGroup.create({ data: input });
    }),

  create: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      articleGroupId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.article.create({ data: input });
    }),

  update: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      id: z.string(),
      code: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      articleGroupId: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.article.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.article.update({
        where: { id: input },
        data: { active: false },
      });
    }),
});
