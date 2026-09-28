import { z } from "zod";

export const trackSchema = z.object({
  referenceId: z.string().trim().min(3, "Enter a booking or reference ID").max(40, "That reference is too long"),
  /** The last 4 digits of the mobile number, or the email address, used on the request. */
  verifier: z
    .string()
    .trim()
    .min(1, "Enter the last 4 digits of your mobile number or your email")
    .max(254)
    .refine((value) => /^\d{4}$/.test(value) || z.string().email().safeParse(value).success, "Enter the last 4 digits of your mobile number, or your email"),
});

export type TrackValues = z.infer<typeof trackSchema>;
