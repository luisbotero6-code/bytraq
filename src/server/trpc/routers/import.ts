import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../index";
import type { AbsenceReason } from "@/generated/prisma";

const adminProcedure = protectedProcedure.use(requireRole("ADMIN"));

const ABSENCE_CODE_MAP: Record<string, AbsenceReason> = {
  SEM: "SEMESTER",
  VAB: "VAB",
  SJK: "SJUK",
  FRA: "FRANVARO_OVRIGT",
  FRX: "FLEXTID",
  FOL: "FORALDRALEDIG",
};

export const importRouter = router({
  importEmployees: adminProcedure
    .input(z.array(z.object({
      employeeNumber: z.string().optional(),
      name: z.string().min(1),
      personalNumber: z.string().optional(),
      costPerHour: z.number().min(0),
      defaultPricePerHour: z.number().min(0),
      weeklyHours: z.number().min(0),
      targetUtilization: z.number().min(0).max(1),
    })))
    .mutation(async ({ ctx, input }) => {
      const data = input.map(row => ({
        employeeNumber: row.employeeNumber || null,
        name: row.name,
        personalNumber: row.personalNumber || null,
        costPerHour: row.costPerHour,
        defaultPricePerHour: row.defaultPricePerHour,
        weeklyHours: row.weeklyHours,
        targetUtilization: row.targetUtilization,
      }));
      const created = await ctx.db.employee.createManyAndReturn({
        data,
        skipDuplicates: true,
        select: { id: true },
      });

      if (created.length > 0) {
        await ctx.db.importBatch.create({
          data: {
            type: "EMPLOYEE",
            count: created.length,
            entityIds: created.map(r => r.id),
            createdById: ctx.user.id,
          },
        });
      }

      return { count: created.length };
    }),

  importCustomers: adminProcedure
    .input(z.array(z.object({
      customerNumber: z.string().optional(),
      name: z.string().min(1),
      orgnr: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const data = input.map(row => ({
        customerNumber: row.customerNumber || null,
        name: row.name,
        orgnr: row.orgnr || null,
        postalCode: row.postalCode || null,
        city: row.city || null,
        country: row.country || null,
        phone: row.phone || null,
      }));

      const created = await ctx.db.customer.createManyAndReturn({
        data,
        skipDuplicates: true,
        select: { id: true },
      });

      if (created.length > 0) {
        await ctx.db.importBatch.create({
          data: {
            type: "CUSTOMER",
            count: created.length,
            entityIds: created.map(r => r.id),
            createdById: ctx.user.id,
          },
        });
      }

      return { count: created.length };
    }),

  importArticles: adminProcedure
    .input(z.array(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      defaultPrice: z.number().optional(),
      groupName: z.string().min(1),
    })))
    .mutation(async ({ ctx, input }) => {
      const groups = await ctx.db.articleGroup.findMany({ select: { id: true, name: true } });
      const groupByName = new Map(groups.map(g => [g.name.toLowerCase(), g.id]));

      // Auto-create missing groups
      const missingGroups = new Set<string>();
      for (const row of input) {
        const key = row.groupName.toLowerCase();
        if (!groupByName.has(key)) missingGroups.add(row.groupName);
      }
      for (const name of missingGroups) {
        const created = await ctx.db.articleGroup.create({
          data: { name, type: "ORDINARIE" },
        });
        groupByName.set(name.toLowerCase(), created.id);
      }

      const data = input.map(row => ({
        code: row.code,
        name: row.name,
        defaultPrice: row.defaultPrice,
        articleGroupId: groupByName.get(row.groupName.toLowerCase())!,
      }));

      const created = await ctx.db.article.createManyAndReturn({
        data,
        skipDuplicates: true,
        select: { id: true },
      });
      const createdGroups = missingGroups.size > 0
        ? Array.from(missingGroups)
        : [];

      if (created.length > 0) {
        await ctx.db.importBatch.create({
          data: {
            type: "ARTICLE",
            count: created.length,
            entityIds: created.map(r => r.id),
            createdById: ctx.user.id,
          },
        });
      }

      return { count: created.length, skipped: [] as string[], createdGroups };
    }),

  importTimeEntries: adminProcedure
    .input(z.array(z.object({
      employeeName: z.string(),
      customerNumber: z.string().optional(),
      customerName: z.string(),
      articleCode: z.string(),
      date: z.string(),
      hours: z.number().min(0),
      regKod: z.string().optional(),
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
        select: { id: true, name: true, customerNumber: true },
      });
      const articles = await ctx.db.article.findMany({
        select: { id: true, code: true },
      });

      const empByName = new Map(employees.map(e => [e.name.toLowerCase(), e]));
      const custByName = new Map(customers.map(c => [c.name.toLowerCase(), c]));
      const custByNumber = new Map(
        customers.filter(c => c.customerNumber).map(c => [c.customerNumber!.toLowerCase(), c]),
      );
      const artByCode = new Map(articles.map(a => [a.code.toLowerCase(), a]));

      const skipped: string[] = [];
      const timeData: {
        employeeId: string;
        customerId: string;
        articleId: string;
        date: Date;
        hours: number;
        comment: string | null;
        costAmount: number;
        calculatedPrice: number;
      }[] = [];
      const absenceData: {
        employeeId: string;
        date: Date;
        hours: number;
        reason: AbsenceReason;
      }[] = [];

      for (let i = 0; i < input.length; i++) {
        const row = input[i];
        const code = row.regKod?.trim().toUpperCase();
        const absenceReason = code ? ABSENCE_CODE_MAP[code] : undefined;

        // --- Absence row ---
        if (absenceReason) {
          if (!row.employeeName.trim()) {
            skipped.push(`Rad ${i + 1}: medarbetare saknas (frånvaro ${code})`);
            continue;
          }
          if (!row.date.trim()) {
            skipped.push(`Rad ${i + 1}: datum saknas (frånvaro ${code}, ${row.employeeName})`);
            continue;
          }
          const emp = empByName.get(row.employeeName.toLowerCase().trim());
          if (!emp) {
            skipped.push(`Rad ${i + 1}: medarbetare "${row.employeeName}" hittades inte`);
            continue;
          }
          const hours = row.hours > 0 ? row.hours : 8;
          absenceData.push({
            employeeId: emp.id,
            date: new Date(row.date),
            hours,
            reason: absenceReason,
          });
          continue;
        }

        // --- Time entry row ---
        const empty: string[] = [];
        if (!row.employeeName.trim()) empty.push("medarbetare");
        if (!row.customerName.trim() && !row.customerNumber?.trim()) empty.push("kund");
        if (!row.articleCode.trim()) empty.push("artikelkod");
        if (!row.date.trim()) empty.push("datum");

        if (empty.length > 0) {
          const ctx_parts = [row.date, row.customerName, row.employeeName].filter(Boolean);
          const ctx_info = ctx_parts.length > 0 ? ` (${ctx_parts.join(", ")})` : "";
          skipped.push(`Rad ${i + 1}: ${empty.join(", ")} saknas${ctx_info}`);
          continue;
        }

        const emp = empByName.get(row.employeeName.toLowerCase().trim());
        const cust = (row.customerNumber?.trim() && custByNumber.get(row.customerNumber.toLowerCase().trim()))
          || custByName.get(row.customerName.toLowerCase().trim());
        const art = artByCode.get(row.articleCode.toLowerCase().trim());

        const missing: string[] = [];
        if (!emp) missing.push(`medarbetare "${row.employeeName}"`);
        if (!cust) missing.push(`kund "${row.customerName}"`);
        if (!art) missing.push(`artikel "${row.articleCode}"`);

        if (missing.length > 0) {
          skipped.push(`Rad ${i + 1}: ${missing.join(", ")} hittades inte`);
          continue;
        }

        const costAmount = row.costAmount ?? Number(emp!.costPerHour) * row.hours;
        const calculatedPrice = row.price ?? Number(emp!.defaultPricePerHour) * row.hours;

        timeData.push({
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

      let timeCount = 0;
      if (timeData.length > 0) {
        const created = await ctx.db.timeEntry.createManyAndReturn({
          data: timeData,
          select: { id: true },
        });
        timeCount = created.length;

        if (created.length > 0) {
          await ctx.db.importBatch.create({
            data: {
              type: "TIME_ENTRY",
              count: created.length,
              entityIds: created.map(r => r.id),
              createdById: ctx.user.id,
            },
          });
        }
      }

      let absenceCount = 0;
      if (absenceData.length > 0) {
        const created = await ctx.db.absence.createManyAndReturn({
          data: absenceData,
          select: { id: true },
        });
        absenceCount = created.length;

        if (created.length > 0) {
          await ctx.db.importBatch.create({
            data: {
              type: "ABSENCE",
              count: created.length,
              entityIds: created.map(r => r.id),
              createdById: ctx.user.id,
            },
          });
        }
      }

      return { count: timeCount, absenceCount, skipped };
    }),

  listBatches: adminProcedure
    .query(async ({ ctx }) => {
      return ctx.db.importBatch.findMany({
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      });
    }),

  deleteBatch: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await ctx.db.importBatch.findUnique({
        where: { id: input.id },
      });

      if (!batch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Importbatch hittades inte" });
      }

      const ids = batch.entityIds as string[];

      switch (batch.type) {
        case "EMPLOYEE":
          await ctx.db.employee.deleteMany({ where: { id: { in: ids } } });
          break;
        case "CUSTOMER":
          await ctx.db.customer.deleteMany({ where: { id: { in: ids } } });
          break;
        case "ARTICLE":
          await ctx.db.article.deleteMany({ where: { id: { in: ids } } });
          break;
        case "TIME_ENTRY":
          await ctx.db.timeEntry.deleteMany({ where: { id: { in: ids } } });
          break;
        case "ABSENCE":
          await ctx.db.absence.deleteMany({ where: { id: { in: ids } } });
          break;
      }

      await ctx.db.importBatch.delete({ where: { id: input.id } });

      return { deleted: ids.length };
    }),
});
