import { z } from "zod";

/**
 * A bare `travelDate` field value (e.g. "2026-10-23") is parsed by `new
 * Date(...)` as UTC midnight, per the ES spec's date-only-string handling —
 * not local midnight. Anchoring "today"/the window boundary to UTC midnight
 * of today's *local calendar date* (rather than `new Date(); setHours(0,0,0,0)`,
 * which is local midnight) keeps both sides of every comparison on the same
 * UTC-midnight-instant footing, so the boundary isn't off by the local UTC
 * offset (caught by a same-day and an exactly-45-day-out test).
 */
const todayAtMidnight = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

/** Flight_Special_Fare.md §3: "Maximum travel request window: 45 days." */
const MAX_TRAVEL_WINDOW_DAYS = 45;
const maxTravelDate = () => {
  const d = todayAtMidnight();
  d.setUTCDate(d.getUTCDate() + MAX_TRAVEL_WINDOW_DAYS);
  return d;
};

/**
 * Flight_Special_Fare.md §6/§7: each passenger's type (Adult/Child/Infant)
 * is computed from their DOB on the travel date, not asked directly — so
 * the form collects fullName + dob per passenger instead of the old plain
 * headcount string. See src/lib/leads/pax-type.ts for the DOB->type
 * calculation, run server-side at lead-creation time.
 */
export const flightPassengerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the passenger's full name").max(80, "Name is too long"),
  dob: z
    .string()
    .min(1, "Select date of birth")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date of birth"),
});

/**
 * Flight Special Fare request validation. No frontend flow existed for
 * this yet — captures route + dates + passengers per the spec description
 * ("our team will confirm availability", no live search, so no flight-
 * result fields belong here). `passengers` was previously a plain
 * "how many" count string; rebuilt as a real per-passenger array so DOB-
 * based Adult/Child/Infant typing (§7, locked) can actually be recorded —
 * `Quotation.infantFare` already existed with no passenger type able to
 * use it (AUDIT_REPORT.md §2.4, CONFLICTING).
 */
export const flightSpecialFareStep1Schema = z.object({
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
    }, "Travel date must be today or later")
    .refine((value) => new Date(value) <= maxTravelDate(), `Travel date must be within ${MAX_TRAVEL_WINDOW_DAYS} days`),
  returnDate: z.string().optional(),
});

export const flightSpecialFareStep2Schema = z.object({
  passengers: z.array(flightPassengerSchema).min(1, "Add at least one passenger").max(9, "Contact us directly for 9+ passengers"),
});

export const flightSpecialFareRequestSchema = flightSpecialFareStep1Schema.extend(flightSpecialFareStep2Schema.shape);

export type FlightPassengerValues = z.infer<typeof flightPassengerSchema>;
export type FlightSpecialFareRequestValues = z.infer<typeof flightSpecialFareRequestSchema>;

export const flightSpecialFareStepFields: Record<number, (keyof FlightSpecialFareRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "origin", "destination", "travelDate", "returnDate"],
  1: ["passengers"],
  2: [],
};

export const flightSpecialFareStepLabels = ["Trip Details", "Passengers", "Summary"];
