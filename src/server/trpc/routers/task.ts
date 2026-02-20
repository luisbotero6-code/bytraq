import { z } from "zod";
import { router, protectedProcedure } from "../index";

export const taskRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["BACKLOG", "IN_PROGRESS", "DONE"]).optional(),
      assigneeId: z.string().optional(),
      customerId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findMany({
        where: {
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.assigneeId ? { assigneeId: input.assigneeId } : {}),
          ...(input?.customerId ? { customerId: input.customerId } : {}),
        },
        include: {
          assignee: true,
          customer: true,
          _count: { select: { comments: true } },
        },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      });
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findUniqueOrThrow({
        where: { id: input },
        include: {
          assignee: true,
          customer: true,
          comments: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      dueDate: z.string().optional().nullable(),
      assigneeId: z.string().optional().nullable(),
      customerId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { dueDate, ...rest } = input;
      return ctx.db.task.create({
        data: { ...rest, dueDate: dueDate ? new Date(dueDate) : null },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      status: z.enum(["BACKLOG", "IN_PROGRESS", "DONE"]).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueDate: z.string().optional().nullable(),
      assigneeId: z.string().optional().nullable(),
      customerId: z.string().optional().nullable(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, dueDate, ...rest } = input;
      return ctx.db.task.update({
        where: { id },
        data: {
          ...rest,
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.delete({ where: { id: input } });
    }),

  addComment: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.taskComment.create({
        data: { ...input, userId: ctx.user.id },
      });
    }),
});
