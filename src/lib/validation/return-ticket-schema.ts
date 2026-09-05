import { z } from "zod";

const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Return Verified Ticket request validation. No frontend flow exists for
 * this yet — field set mirrors the sibling flows.
 */
export const returnTicketRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    destinationCountry: z.string().min(1, "Select a destination country"),
    travelDate: z
      .string()
      .min(1, "Select a travel date")
      .refine((value) => {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= todayAtMidnight();
      }, "Travel date must be today or later"),
    returnDate: z.string().min(1, "Select a return date"),
    travelers: z
      .string()
      .trim()
      .regex(/^[1-9]$/, "Enter a number between 1 and 9 (contact us directly for 9+)"),
  })
  .refine((values) => new Date(values.returnDate) >= new Date(values.travelDate), {
    message: "Return date must be on or after the travel date",
    path: ["returnDate"],
  });

export type ReturnTicketRequestValues = z.infer<typeof returnTicketRequestSchema>;
