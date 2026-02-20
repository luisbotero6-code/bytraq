import { z } from "zod";
import { addDays, endOfWeek } from "date-fns";
import { router, protectedProcedure } from "../index";
import type { AbsenceReason } from "@/generated/prisma";
import { ABSENCE_CODE_TO_REASON } from "@/lib/constants";

export const absenceRouter = router({
  getWeek: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      weekStart: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const start = new Date(input.weekStart);
      const end = endOfWeek(start, { weekStartsOn: 1 });

      return ctx.db.absence.findMany({
        where: {
          employeeId: input.employeeId,
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      });
    }),

  getDay: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.absence.findMany({
        where: {
          employeeId: input.employeeId,
          date: new Date(input.date),
        },
        orderBy: { id: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      date: z.string(),
      code: z.string().min(1, "Välj en registreringskod"),
      hours: z.number().min(0).max(24),
      comment: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reason = (ABSENCE_CODE_TO_REASON[input.code] ?? "FRANVARO_OVRIGT") as AbsenceReason;

      return ctx.db.absence.create({
        data: {
          employeeId: input.employeeId,
          date: new Date(input.date),
          hours: input.hours,
          reason,
          code: input.code,
          comment: input.comment ?? null,
        },
      });
    }),

  createRange: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      code: z.string().min(1, "Välj en registreringskod"),
      hours: z.number().min(0).max(24),
      comment: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reason = (ABSENCE_CODE_TO_REASON[input.code] ?? "FRANVARO_OVRIGT") as AbsenceReason;
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

      const dates: Date[] = [];
      let current = start;
      while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
          dates.push(new Date(current));
        }
        current = addDays(current, 1);
      }

      if (dates.length === 0) return { count: 0 };

      const data = dates.map((d) => ({
        employeeId: input.employeeId,
        date: d,
        hours: input.hours,
        reason,
        code: input.code,
        comment: input.comment ?? null,
      }));

      const created = await ctx.db.absence.createMany({ data });
      return { count: created.count };
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.absence.delete({ where: { id: input } });
    }),
});
