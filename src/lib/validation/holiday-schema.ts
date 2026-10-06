import { z } from "zod";

export const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  /** Client corrections 2026-10-05 — any enabled Country master row. */
  countryId: z.string().trim().min(1, "Select a country"),
  name: z.string().trim().min(2, "Enter the holiday name").max(80, "Name is too long"),
});

export const updateHolidaySchema = z.object({
  name: z.string().trim().min(2, "Enter the holiday name").max(80, "Name is too long").optional(),
  active: z.boolean().optional(),
});
