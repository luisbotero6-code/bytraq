import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const customerRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      segmentId: z.string().optional(),
      active: z.boolean().optional().default(true),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.customer.findMany({
        where: {
          active: input?.active ?? true,
          deletedAt: null,
          ...(input?.search ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { orgnr: { contains: input.search } },
            ],
          } : {}),
          ...(input?.segmentId ? { segmentId: input.segmentId } : {}),
        },
        include: { manager: true, segment: true },
        orderBy: { name: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.db.customer.findUniqueOrThrow({
        where: { id: input },
        include: { manager: true, segment: true },
      });
    }),

  create: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      name: z.string().min(1),
      orgnr: z.string().optional(),
      customerType: z.enum(["LOPANDE", "FASTPRIS", "BLANDAD"]),
      clientManagerId: z.string().optional().nullable(),
      segmentId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customer.create({ data: input });
    }),

  update: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      orgnr: z.string().optional().nullable(),
      customerType: z.enum(["LOPANDE", "FASTPRIS", "BLANDAD"]).optional(),
      clientManagerId: z.string().optional().nullable(),
      segmentId: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.customer.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customer.update({
        where: { id: input },
        data: { deletedAt: new Date(), active: false },
      });
    }),
});
