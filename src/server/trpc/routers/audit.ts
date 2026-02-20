import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const auditRouter = router({
  list: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      userId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.entityType) where.entityType = input.entityType;
      if (input?.entityId) where.entityId = input.entityId;
      if (input?.userId) where.userId = input.userId;
      if (input?.from || input?.to) {
        where.timestamp = {
          ...(input?.from ? { gte: new Date(input.from) } : {}),
          ...(input?.to ? { lte: new Date(input.to) } : {}),
        };
      }

      const [items, total] = await Promise.all([
        ctx.db.auditLog.findMany({
          where,
          include: { user: { select: { name: true, email: true } } },
          orderBy: { timestamp: "desc" },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0,
        }),
        ctx.db.auditLog.count({ where }),
      ]);

      return { items, total };
    }),
});
