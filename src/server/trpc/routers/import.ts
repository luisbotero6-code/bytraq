import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../index";

const adminProcedure = protectedProcedure.use(requireRole("ADMIN"));

export const importRouter = router({
  importEmployees: adminProcedure
    .input(z.array(z.object({
      name: z.string().min(1),
      costPerHour: z.number().positive(),
      defaultPricePerHour: z.number().positive(),
      weeklyHours: z.number().positive(),
      targetUtilization: z.number().min(0).max(1),
    })))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.employee.createMany({ data: input, skipDuplicates: true });
      return { count: result.count };
    }),

  importCustomers: adminProcedure
    .input(z.array(z.object({
      name: z.string().min(1),
      orgnr: z.string().min(1),
      customerType: z.enum(["LOPANDE", "FASTPRIS", "BLANDAD"]),
      clientManagerName: z.string().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const employees = await ctx.db.employee.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });
      const employeeByName = new Map(employees.map(e => [e.name.toLowerCase(), e.id]));

      const data = input.map(({ clientManagerName, ...rest }) => ({
        ...rest,
        clientManagerId: clientManagerName
          ? employeeByName.get(clientManagerName.toLowerCase()) ?? null
          : null,
      }));

      const result = await ctx.db.customer.createMany({ data, skipDuplicates: true });
      return { count: result.count };
    }),

  importArticles: adminProcedure
    .input(z.array(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      groupName: z.string().min(1),
    })))
    .mutation(async ({ ctx, input }) => {
      const groups = await ctx.db.articleGroup.findMany({ select: { id: true, name: true } });
      const groupByName = new Map(groups.map(g => [g.name.toLowerCase(), g.id]));

      const skipped: string[] = [];
      const data: { code: string; name: string; articleGroupId: string }[] = [];

      for (const row of input) {
        const groupId = groupByName.get(row.groupName.toLowerCase());
        if (!groupId) {
          skipped.push(`${row.code}: grupp "${row.groupName}" hittades inte`);
          continue;
        }
        data.push({ code: row.code, name: row.name, articleGroupId: groupId });
      }

      const result = data.length > 0
        ? await ctx.db.article.createMany({ data, skipDuplicates: true })
        : { count: 0 };

      return { count: result.count, skipped };
    }),

  importTimeEntries: adminProcedure
    .input(z.array(z.object({
      employeeName: z.string().min(1),
      customerName: z.string().min(1),
      articleCode: z.string().min(1),
      date: z.string().min(1),
      hours: z.number().min(0),
      costAmount: z.number().optional(),
      price: z.number().optional(),
      comment: z.string().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const employees = await ctx.db.employee.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, costPerHour: true, defaultPricePerHour: true },
      });
      const customers = await ctx.db.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });
      const articles = await ctx.db.article.findMany({
        select: { id: true, code: true },
      });

      const empByName = new Map(employees.map(e => [e.name.toLowerCase(), e]));
      const custByName = new Map(customers.map(c => [c.name.toLowerCase(), c]));
      const artByCode = new Map(articles.map(a => [a.code.toLowerCase(), a]));

      const skipped: string[] = [];
      const data: {
        employeeId: string;
        customerId: string;
        articleId: string;
        date: Date;
        hours: number;
        comment: string | null;
        costAmount: number;
        calculatedPrice: number;
      }[] = [];

      for (let i = 0; i < input.length; i++) {
        const row = input[i];
        const emp = empByName.get(row.employeeName.toLowerCase());
        const cust = custByName.get(row.customerName.toLowerCase());
        const art = artByCode.get(row.articleCode.toLowerCase());

        const missing: string[] = [];
        if (!emp) missing.push(`medarbetare "${row.employeeName}"`);
        if (!cust) missing.push(`kund "${row.customerName}"`);
        if (!art) missing.push(`artikel "${row.articleCode}"`);

        if (missing.length > 0) {
          skipped.push(`Rad ${i + 1}: ${missing.join(", ")} hittades inte`);
          continue;
        }

        // Use source cost/price if provided, otherwise calculate from employee rates
        const costAmount = row.costAmount ?? Number(emp!.costPerHour) * row.hours;
        const calculatedPrice = row.price ?? Number(emp!.defaultPricePerHour) * row.hours;

        data.push({
          employeeId: emp!.id,
          customerId: cust!.id,
          articleId: art!.id,
          date: new Date(row.date),
          hours: row.hours,
          comment: row.comment ?? null,
          costAmount,
          calculatedPrice,
        });
      }

      const result = data.length > 0
        ? await ctx.db.timeEntry.createMany({ data })
        : { count: 0 };

      return { count: result.count, skipped };
    }),
});
