import { z } from "zod";

const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Flight Special Fare request validation. No frontend flow exists for this
 * yet — captures route + dates + passengers per the spec description ("our
 * team will confirm availability", no live search, so no flight-result
 * fields belong here).
 */
export const flightSpecialFareRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  origin: z.string().trim().min(2, "Enter a departure city or airport"),
  destination: z.string().trim().min(2, "Enter an arrival city or airport"),
  travelDate: z
    .string()
    .min(1, "Select a travel date")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= todayAtMidnight();
    }, "Travel date must be today or later"),
  returnDate: z.string().optional(),
  passengers: z
    .string()
    .trim()
    .regex(/^[1-9]$/, "Enter a number between 1 and 9 (contact us directly for 9+)"),
});

export type FlightSpecialFareRequestValues = z.infer<typeof flightSpecialFareRequestSchema>;
