import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const employeeRouter = router({
  list: protectedProcedure
    .input(z.object({ active: z.boolean().optional().default(true) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.employee.findMany({
        where: { active: input?.active ?? true, deletedAt: null },
        include: { userMapping: { include: { user: { select: { email: true, role: true } } } } },
        orderBy: { name: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.db.employee.findUniqueOrThrow({
        where: { id: input },
        include: { costHistory: { orderBy: { effectiveFrom: "desc" } }, userMapping: true },
      });
    }),

  create: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      name: z.string().min(1),
      costPerHour: z.number().positive(),
      defaultPricePerHour: z.number().positive(),
      weeklyHours: z.number().positive().default(40),
      targetUtilization: z.number().min(0).max(1).default(0.75),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.employee.create({ data: input });
    }),

  update: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      costPerHour: z.number().positive().optional(),
      defaultPricePerHour: z.number().positive().optional(),
      weeklyHours: z.number().positive().optional(),
      targetUtilization: z.number().min(0).max(1).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.employee.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.employee.update({
        where: { id: input },
        data: { deletedAt: new Date(), active: false },
      });
    }),
});
