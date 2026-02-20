import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

/** Create UTC noon date from YYYY-MM-DD string to avoid timezone shifting */
function utcNoon(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

export const calendarRouter = router({
  list: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      const startDate = utcNoon(`${input.year}-${String(input.month).padStart(2, "0")}-01`);
      const lastDay = new Date(Date.UTC(input.year, input.month, 0)).getUTCDate();
      const endDate = utcNoon(`${input.year}-${String(input.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);

      return ctx.db.calendarDay.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: "asc" },
      });
    }),

  listYear: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ ctx, input }) => {
      const startDate = utcNoon(`${input.year}-01-01`);
      const endDate = utcNoon(`${input.year}-12-31`);
      return ctx.db.calendarDay.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: "asc" },
      });
    }),

  upsert: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      date: z.string(),
      isHoliday: z.boolean(),
      holidayName: z.string().optional().nullable(),
      workHours: z.number().min(0).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = utcNoon(input.date);
      const dow = date.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;

      const result = await ctx.db.calendarDay.upsert({
        where: { date },
        create: {
          date,
          isWeekend,
          isHoliday: input.isHoliday,
          holidayName: input.holidayName ?? null,
          workHours: input.workHours,
        },
        update: {
          isHoliday: input.isHoliday,
          holidayName: input.holidayName ?? null,
          workHours: input.workHours,
        },
      });

      // If marking as holiday, auto-create half day on the weekday before
      if (input.isHoliday) {
        const prevDate = utcNoon(input.date);
        prevDate.setUTCDate(prevDate.getUTCDate() - 1);
        const prevDow = prevDate.getUTCDay();
        const prevIsWeekend = prevDow === 0 || prevDow === 6;

        if (!prevIsWeekend) {
          const existing = await ctx.db.calendarDay.findUnique({ where: { date: prevDate } });
          if (!existing?.isHoliday) {
            await ctx.db.calendarDay.upsert({
              where: { date: prevDate },
              create: {
                date: prevDate,
                isWeekend: false,
                isHoliday: false,
                holidayName: "Halvdag före röd dag",
                workHours: 5,
              },
              update: {
                workHours: 5,
                holidayName: "Halvdag före röd dag",
              },
            });
          }
        }
      }

      return result;
    }),

  delete: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const date = utcNoon(input);

      // If removing a holiday, also reset the half day before it
      const existing = await ctx.db.calendarDay.findUnique({ where: { date } });
      if (existing?.isHoliday) {
        const prevDate = utcNoon(input);
        prevDate.setUTCDate(prevDate.getUTCDate() - 1);
        const prevEntry = await ctx.db.calendarDay.findUnique({ where: { date: prevDate } });
        if (prevEntry && !prevEntry.isHoliday && !prevEntry.isWeekend && Number(prevEntry.workHours) === 5) {
          await ctx.db.calendarDay.update({
            where: { date: prevDate },
            data: { workHours: 8, holidayName: null },
          });
        }
      }

      return ctx.db.calendarDay.delete({ where: { date } });
    }),
});
