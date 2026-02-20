import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const periodLockRouter = router({
  list: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .query(async ({ ctx }) => {
      return ctx.db.periodLock.findMany({
        include: {
          lockedBy: { select: { name: true } },
          unlockedBy: { select: { name: true } },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 18,
      });
    }),

  lock: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.periodLock.upsert({
        where: { year_month: { year: input.year, month: input.month } },
        create: {
          year: input.year,
          month: input.month,
          lockedById: ctx.user.id,
        },
        update: {
          unlockedAt: null,
          unlockedById: null,
          lockedAt: new Date(),
          lockedById: ctx.user.id,
        },
      });
    }),

  unlock: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.periodLock.update({
        where: { year_month: { year: input.year, month: input.month } },
        data: { unlockedAt: new Date(), unlockedById: ctx.user.id },
      });
    }),
});
