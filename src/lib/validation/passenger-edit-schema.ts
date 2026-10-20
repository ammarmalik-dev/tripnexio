import { z } from "zod";

/** Client doc 2026-10-20 (A4) — a traveller staff add to a request or correct (name, type, DOB, passport). */
export const passengerInputSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the passenger's full name").max(120),
  paxType: z.enum(["ADULT", "CHILD", "INFANT"], { error: "Select the passenger type" }),
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .optional()
    .or(z.literal("")),
  passportNumber: z.string().trim().max(20).optional().or(z.literal("")),
});

export type PassengerInputValues = z.infer<typeof passengerInputSchema>;
