import { z } from "zod";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P22 item 7 — multi-sector itinerary on a quotation (Quotation.itinerary,
 * a Json column). Pure module (no `db` import) so the CRM quote builder and
 * the customer quote page can import it directly — see validity-cap.ts's
 * doc comment for why DB-backed helpers must stay out of client bundles.
 */

export const MAX_ITINERARY_SEGMENTS = 8;

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`).optional();

/** Empty string is allowed (an untouched <input type="datetime-local">); anything else must parse as a date. */
const optionalDateTime = z
  .string()
  .trim()
  .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), "Enter a valid date/time")
  .optional();

export const itinerarySegmentSchema = z.object({
  from: z.string().trim().min(1, "Enter where this sector departs from").max(80, "Keep this under 80 characters"),
  to: z.string().trim().min(1, "Enter where this sector arrives").max(80, "Keep this under 80 characters"),
  departAt: optionalDateTime,
  arriveAt: optionalDateTime,
  airline: optionalText(80),
  flightNumber: optionalText(20),
  notes: optionalText(300),
});

export const itinerarySchema = z
  .array(itinerarySegmentSchema)
  .max(MAX_ITINERARY_SEGMENTS, `An itinerary can have at most ${MAX_ITINERARY_SEGMENTS} sectors`);

export type ItinerarySegment = z.infer<typeof itinerarySegmentSchema>;

/** Only Visa Change (A2A/Border flight legs) and Flight Special Fare quotes carry a multi-sector itinerary. */
export function supportsMultiSectorItinerary(serviceType: ServiceType): boolean {
  return serviceType === "VISA_CHANGE" || serviceType === "FLIGHT_SPECIAL_FARE";
}

/** Normalized, storage-ready segment: blank optional strings dropped, date/times stored as ISO strings. */
export interface StoredItinerarySegment {
  from: string;
  to: string;
  departAt?: string;
  arriveAt?: string;
  airline?: string;
  flightNumber?: string;
  notes?: string;
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function toIso(value: string | undefined): string | undefined {
  const present = blankToUndefined(value);
  return present ? new Date(present).toISOString() : undefined;
}

/** Validated form/API input → what gets written to Quotation.itinerary. */
export function normalizeItinerary(segments: ItinerarySegment[]): StoredItinerarySegment[] {
  return segments.map((segment) => {
    const stored: StoredItinerarySegment = { from: segment.from.trim(), to: segment.to.trim() };
    const departAt = toIso(segment.departAt);
    const arriveAt = toIso(segment.arriveAt);
    const airline = blankToUndefined(segment.airline);
    const flightNumber = blankToUndefined(segment.flightNumber);
    const notes = blankToUndefined(segment.notes);
    if (departAt) stored.departAt = departAt;
    if (arriveAt) stored.arriveAt = arriveAt;
    if (airline) stored.airline = airline;
    if (flightNumber) stored.flightNumber = flightNumber;
    if (notes) stored.notes = notes;
    return stored;
  });
}

/** Defensive read of the Json column — anything malformed is dropped rather than trusted. */
export function parseStoredItinerary(value: unknown): StoredItinerarySegment[] {
  if (!Array.isArray(value)) return [];
  const result: StoredItinerarySegment[] = [];
  for (const raw of value) {
    const parsed = itinerarySegmentSchema.safeParse(raw);
    if (parsed.success) result.push(normalizeItinerary([parsed.data])[0]);
  }
  return result;
}
