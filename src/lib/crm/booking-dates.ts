import type { ServiceType } from "../../generated/prisma/enums";

/**
 * CRM.md §12 BOOKING DATES — "Avoid ambiguous generic 'Date' labels." One
 * place mapping a booking's service type to the exact, separately-labelled
 * dates (and the few non-date facts §12 lists alongside them, e.g. Visa
 * Change's Visa Number) staff see in the booking header.
 *
 * `value` is either a full ISO timestamp (from a DB DateTime) or a plain
 * `YYYY-MM-DD` string (as customers submit dates on the intake forms, kept
 * verbatim in Lead.details). `null` means "not recorded yet" — the label is
 * still shown so staff can see what's missing rather than the row silently
 * disappearing.
 */
export interface BookingDateItem {
  key: string;
  label: string;
  value: string | null;
  kind: "date" | "text";
  /** Optional qualifier, e.g. "earliest of 3 passengers". */
  hint?: string;
}

export interface BookingDatesInput {
  serviceType: ServiceType;
  details: unknown;
  bookingCreatedAt: Date;
  appliedToEmbassyAt: Date | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function dateString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function textString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Earliest valid date among per-passenger entries — the one that constrains the booking. */
function earliestDate(entries: unknown, field: string): { value: string | null; count: number } {
  if (!Array.isArray(entries)) return { value: null, count: 0 };
  const dates = entries
    .map((entry) => dateString(asRecord(entry)[field]))
    .filter((value): value is string => value !== null);
  if (dates.length === 0) return { value: null, count: 0 };
  const earliest = dates.reduce((min, value) => (new Date(value).getTime() < new Date(min).getTime() ? value : min));
  return { value: earliest, count: new Set(dates).size };
}

function date(key: string, label: string, value: string | null, hint?: string): BookingDateItem {
  return hint ? { key, label, value, kind: "date", hint } : { key, label, value, kind: "date" };
}

export function getBookingDates(input: BookingDatesInput): BookingDateItem[] {
  const details = asRecord(input.details);
  const bookingDate = date("bookingDate", "Booking Date", input.bookingCreatedAt.toISOString());

  switch (input.serviceType) {
    case "NEW_VISA":
      return [
        bookingDate,
        date("appliedToEmbassyDate", "Applied to Embassy Date", input.appliedToEmbassyAt ? input.appliedToEmbassyAt.toISOString() : null),
        date("travelDate", "Travel / Required Date", dateString(details.travelDate)),
      ];

    case "VISA_EXTENSION": {
      // Staff-verified expiry (visa-extension-verify route) wins over the
      // customer-submitted one — same precedence the reminder automation uses.
      const verified = dateString(details.verifiedExpiryDate);
      const applicants = earliestDate(details.applicants, "visaExpiryDate");
      const submitted = dateString(details.visaExpiryDate) ?? applicants.value;
      const expiry = verified ?? submitted;
      const hint = verified ? "staff-verified" : applicants.count > 1 ? `earliest of ${applicants.count} applicants` : undefined;
      return [
        bookingDate,
        date("visaExpiryDate", "Current Visa Last Date / Expiry", expiry, hint),
        date("extensionRequiredDate", "Extension Required Date", dateString(details.extensionRequiredDate)),
      ];
    }

    case "VISA_CHANGE": {
      const lastDate = earliestDate(details.passengers, "visaLastDate");
      return [
        bookingDate,
        date("travelDate", "Travel / Required Date", dateString(details.travelDate) ?? dateString(details.requiredDate)),
        { key: "visaNumber", label: "Visa Number", value: textString(details.visaNumber), kind: "text" },
        date(
          "visaLastDate",
          "Visa Last Date / Expiry",
          lastDate.value ?? dateString(details.visaLastDate),
          lastDate.count > 1 ? `earliest of ${lastDate.count} passengers` : undefined
        ),
      ];
    }

    case "FLIGHT_SPECIAL_FARE": {
      const items = [bookingDate, date("travelDate", "Travel / Departure Date", dateString(details.travelDate))];
      const returnDate = dateString(details.returnDate);
      if (returnDate) items.push(date("returnDate", "Return Date", returnDate));
      return items;
    }

    case "RETURN_TICKET": {
      const items = [bookingDate, date("returnTravelDate", "Return Travel Date", dateString(details.expectedReturnDate))];
      // The onward travel date drives the reservation issue window, so it's shown too when present.
      const travelDate = dateString(details.travelDate);
      if (travelDate) items.push(date("travelDate", "Onward Travel Date", travelDate));
      return items;
    }

    case "OTB":
      return [bookingDate, date("travelDate", "Travel Date", dateString(details.travelDate))];

    default:
      return [bookingDate, date("travelDate", "Service / Travel Date", dateString(details.travelDate))];
  }
}
