import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure, requireRole } from "../index";

export const userRouter = router({
  list: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .query(async ({ ctx }) => {
      return ctx.db.user.findMany({
        where: { deletedAt: null },
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, employeeMapping: { select: { employeeId: true, employee: { select: { name: true } } } } },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      role: z.enum(["ADMIN", "BYRALEDNING", "TEAM_LEAD", "MEDARBETARE"]),
      employeeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { password, employeeId, ...userData } = input;
      const passwordHash = await bcrypt.hash(password, 12);

      return ctx.db.user.create({
        data: {
          ...userData,
          passwordHash,
          ...(employeeId ? {
            employeeMapping: { create: { employeeId } },
          } : {}),
        },
      });
    }),

  update: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({
      id: z.string(),
      email: z.string().email().optional(),
      name: z.string().min(1).optional(),
      role: z.enum(["ADMIN", "BYRALEDNING", "TEAM_LEAD", "MEDARBETARE"]).optional(),
      active: z.boolean().optional(),
      password: z.string().min(8).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;
      return ctx.db.user.update({
        where: { id },
        data: {
          ...data,
          ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new Error("Du kan inte ta bort dig själv");
      }
      return ctx.db.user.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), active: false },
      });
    }),

  mapEmployee: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({
      userId: z.string(),
      employeeId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.userEmployeeMapping.upsert({
        where: { userId: input.userId },
        create: input,
        update: { employeeId: input.employeeId },
      });
    }),
});
