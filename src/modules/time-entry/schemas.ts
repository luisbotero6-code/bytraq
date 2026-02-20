import { z } from "zod";

export const timeEntrySchema = z.object({
  id: z.string().optional(),
  employeeId: z.string(),
  customerId: z.string().min(1, "Välj kund"),
  articleId: z.string().min(1, "Välj artikel"),
  date: z.string(),
  hours: z.number().min(0).max(24),
  comment: z.string().optional().nullable(),
  invoiceText: z.string().optional().nullable(),
});

export type TimeEntryFormData = z.infer<typeof timeEntrySchema>;

export const weekRowSchema = z.object({
  customerId: z.string(),
  articleId: z.string(),
  hours: z.array(z.number().min(0).max(24)),
  entryIds: z.array(z.string().optional()),
});

export type WeekRowData = z.infer<typeof weekRowSchema>;
