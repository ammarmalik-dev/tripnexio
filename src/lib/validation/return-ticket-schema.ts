import { z } from "zod";

const todayAtMidnight = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

/**
 * Return Verified Ticket request validation.
 *
 * Return_Verified_Ticket.md §5/§6, locked: "Customer selects only the
 * travel date. The customer does not select the return/onward date." The
 * previous version of this schema accepted a free-input `returnDate` field
 * and an unrelated `destinationCountry` (this service is UAE-only per §3,
 * unlike New Visa/Visa Extension which target a chosen GCC country) —
 * AUDIT_REPORT.md flagged the schema/route as not confirmed to implement
 * the locked rule. Rebuilt: `visaType` (30/60 days) replaces
 * `destinationCountry`, and `returnDate` is gone from customer input
 * entirely — see src/lib/leads/compute-return-date.ts for where it's
 * computed server-side at lead-creation time.
 *
 * Exported as a plain object schema so callers that need one field's own
 * validator in isolation (the WhatsApp bot's conversational field-by-field
 * collection, see src/lib/whatsapp-bot/flows.ts) can do
 * `returnTicketFieldsSchema.shape.travelDate`.
 */
export const returnTicketFieldsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  visaType: z.enum(["THIRTY_DAYS", "SIXTY_DAYS"], { message: "Select your UAE visa type" }),
  travelDate: z
    .string()
    .min(1, "Select a travel date")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= todayAtMidnight();
    }, "Travel date must be today or later"),
  travelers: z
    .string()
    .trim()
    .regex(/^[1-9]$/, "Enter a number between 1 and 9 (contact us directly for 9+)"),
});

export const returnTicketRequestSchema = returnTicketFieldsSchema;

export type ReturnTicketRequestValues = z.infer<typeof returnTicketRequestSchema>;

export const returnTicketStepFields: Record<number, (keyof ReturnTicketRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "visaType", "travelDate", "travelers"],
  1: [],
};

export const returnTicketStepLabels = ["Trip Details", "Summary"];
