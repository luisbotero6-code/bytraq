import { z } from "zod";
import { router, protectedProcedure } from "../index";
import type { AbsenceReason } from "@/generated/prisma";
import { ABSENCE_CODE_TO_REASON } from "@/lib/constants";

export const absenceRouter = router({
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

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.absence.delete({ where: { id: input } });
    }),
});
