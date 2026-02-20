import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

export const dataQualityRouter = router({
  rules: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .query(async ({ ctx }) => {
      return ctx.db.dataQualityRule.findMany({
        include: { _count: { select: { issues: { where: { status: "OPEN" } } } } },
        orderBy: { name: "asc" },
      });
    }),

  issues: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      status: z.enum(["OPEN", "RESOLVED", "IGNORED"]).optional().default("OPEN"),
      severity: z.enum(["INFO", "WARNING", "ERROR"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.dataQualityIssue.findMany({
        where: {
          status: input?.status ?? "OPEN",
          ...(input?.severity ? { severity: input.severity } : {}),
        },
        include: { rule: true },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      });
    }),

  updateIssue: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .input(z.object({
      id: z.string(),
      status: z.enum(["OPEN", "RESOLVED", "IGNORED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.dataQualityIssue.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  runChecks: protectedProcedure
    .use(requireRole("ADMIN", "BYRALEDNING"))
    .mutation(async ({ ctx }) => {
      const newIssues: Array<{
        ruleType: string;
        entityType: string;
        entityId: string;
        severity: "INFO" | "WARNING" | "ERROR";
        message: string;
      }> = [];

      // Check: Users without employee mapping
      const usersWithoutMapping = await ctx.db.user.findMany({
        where: { employeeMapping: null, active: true, deletedAt: null },
      });
      for (const u of usersWithoutMapping) {
        newIssues.push({
          ruleType: "MISSING_EMPLOYEE_MAPPING",
          entityType: "User",
          entityId: u.id,
          severity: "WARNING",
          message: `Användare "${u.name}" saknar koppling till medarbetare`,
        });
      }

      // Check: Customers without client manager
      const customersWithoutManager = await ctx.db.customer.findMany({
        where: { clientManagerId: null, active: true, deletedAt: null },
      });
      for (const c of customersWithoutManager) {
        newIssues.push({
          ruleType: "MISSING_CLIENT_MANAGER",
          entityType: "Customer",
          entityId: c.id,
          severity: "WARNING",
          message: `Kund "${c.name}" saknar klientansvarig`,
        });
      }

      // Check: Customers without segment
      const customersWithoutSegment = await ctx.db.customer.findMany({
        where: { segmentId: null, active: true, deletedAt: null },
      });
      for (const c of customersWithoutSegment) {
        newIssues.push({
          ruleType: "CUSTOMER_WITHOUT_SEGMENT",
          entityType: "Customer",
          entityId: c.id,
          severity: "INFO",
          message: `Kund "${c.name}" saknar kundsegment`,
        });
      }

      // Persist issues
      let created = 0;
      for (const issue of newIssues) {
        const rule = await ctx.db.dataQualityRule.findFirst({
          where: { ruleType: issue.ruleType },
        });
        if (!rule) continue;

        const existing = await ctx.db.dataQualityIssue.findFirst({
          where: {
            ruleId: rule.id,
            entityType: issue.entityType,
            entityId: issue.entityId,
            status: "OPEN",
          },
        });

        if (!existing) {
          await ctx.db.dataQualityIssue.create({
            data: {
              ruleId: rule.id,
              entityType: issue.entityType,
              entityId: issue.entityId,
              severity: issue.severity,
              message: issue.message,
            },
          });
          created++;
        }
      }

      return { checked: newIssues.length, created };
    }),
});
