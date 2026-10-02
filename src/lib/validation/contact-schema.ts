import { z } from "zod";
import { honeypotShape } from "./honeypot";

/** What the customer is writing about — picked on the /contact form. */
export const CONTACT_CATEGORIES = ["GENERAL", "BOOKING", "PAYMENT", "DOCUMENTS", "FEEDBACK", "COMPLAINT"] as const;

/** The /contact form; submitting it creates an Enquiry (CRM → Enquiries), or an escalated complaint. */
export const contactRequestSchema = z.object({
  ...honeypotShape,
  category: z.enum(CONTACT_CATEGORIES, { error: "Choose what your message is about" }),
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  subject: z.string().trim().min(3, "Tell us what it's about").max(120, "Subject is too long"),
  message: z.string().trim().min(10, "Please add a few more details").max(2000, "Message is too long"),
  bookingReference: z.string().trim().max(40, "Reference is too long").optional(),
});

export type ContactRequestValues = z.infer<typeof contactRequestSchema>;
