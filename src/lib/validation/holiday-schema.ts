import { z } from "zod";

export const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  country: z.enum(["INDIA", "UAE"], { error: "Select a country" }),
  name: z.string().trim().min(2, "Enter the holiday name").max(80, "Name is too long"),
});

export const updateHolidaySchema = z.object({
  name: z.string().trim().min(2, "Enter the holiday name").max(80, "Name is too long").optional(),
  active: z.boolean().optional(),
});
