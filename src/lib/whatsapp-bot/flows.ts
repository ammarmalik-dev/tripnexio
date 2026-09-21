import { z } from "zod";
import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import { otbRequestSchema } from "../validation/otb-schema";
import { newVisaRequestSchema } from "../validation/new-visa-schema";
import { visaExtensionBotFieldSchemas, visaExtensionRequestSchema } from "../validation/visa-extension-schema";
import { visaChangeRequestSchema } from "../validation/visa-change-schema";
import { flightSpecialFareRequestSchema, flightPassengerSchema } from "../validation/flight-special-fare-schema";
import { returnTicketFieldsSchema } from "../validation/return-ticket-schema";
import { computeReturnDate, type ReturnTicketVisaType } from "../leads/compute-return-date";
import { getReturnTicketRules } from "../settings/return-ticket-rule-config";
import { SAMPLE_VISA_TYPE_OPTIONS, SAMPLE_AIRLINE_OPTIONS } from "../sample-data";

export interface ParseResult {
  ok: boolean;
  value?: string;
  error?: string;
}

export interface NextField {
  fieldKey: string;
  prompt: string;
  parse: (raw: string) => ParseResult | Promise<ParseResult>;
  /** True when this step has no valid options to offer right now (e.g. no active airports seeded) — the engine hands off instead of asking an empty question. */
  unavailable?: boolean;
}

/**
 * Reused across every service's fullName/email steps (mobile is never
 * asked — the bot already knows it from the customer's WhatsApp number).
 * Each per-service zod schema (otb-schema.ts etc.) defines the identical
 * rule inline for its own web-form use; centralizing it here for the bot's
 * own field-by-field validation isn't a NEW duplication, just one copy
 * instead of re-deriving it per service.
 */
const NAME_VALIDATOR = z.string().trim().min(2, "Enter your full name (at least 2 characters).").max(80, "That name is too long.");
const EMAIL_VALIDATOR = z.string().trim().min(1, "Please share your email address.").email("That doesn't look like a valid email — please try again.");

function textStep(fieldKey: string, prompt: string, validator: z.ZodTypeAny): NextField {
  return {
    fieldKey,
    prompt,
    parse: (raw) => {
      const trimmed = raw.trim();
      const result = validator.safeParse(trimmed);
      if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "That doesn't look right — please try again." };
      return { ok: true, value: trimmed };
    },
  };
}

function numberedChoiceStep(fieldKey: string, header: string, options: { value: string; label: string }[]): NextField {
  if (options.length === 0) {
    return { fieldKey, prompt: header, parse: () => ({ ok: false, error: "Not available right now." }), unavailable: true };
  }
  return {
    fieldKey,
    prompt: `${header}\n${options.map((option, index) => `${index + 1}. ${option.label}`).join("\n")}`,
    parse: (raw) => {
      const n = parseInt(raw.trim(), 10);
      if (Number.isNaN(n) || n < 1 || n > options.length) {
        return { ok: false, error: `Please reply with just a number from 1 to ${options.length}.` };
      }
      return { ok: true, value: options[n - 1].value };
    },
  };
}

/** Accepts ISO (YYYY-MM-DD), DD-MM-YYYY, DD/MM/YYYY, or anything JS Date can parse — returns an ISO date string or null. */
function parseLooseDate(raw: string): string | null {
  const dmy = raw.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const direct = new Date(raw.trim());
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  return null;
}

function dateStep(fieldKey: string, prompt: string, validator: z.ZodTypeAny, extraCheck?: (iso: string) => string | null): NextField {
  return {
    fieldKey,
    prompt: `${prompt} (e.g. 25-12-2026)`,
    parse: (raw) => {
      const iso = parseLooseDate(raw);
      if (!iso) return { ok: false, error: "Please enter a valid date, e.g. 25-12-2026." };
      const result = validator.safeParse(iso);
      if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "That date doesn't work — please try another." };
      if (extraCheck) {
        const extraError = extraCheck(iso);
        if (extraError) return { ok: false, error: extraError };
      }
      return { ok: true, value: iso };
    },
  };
}

const PROCESSING_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

// getActiveAirportOptions/getActiveBorderOptions removed (Step 8,
// client-locked-spec roadmap) -- the customer never picks a specific
// airport/border, only the A2A-vs-Border method (see the VISA_CHANGE case
// below); staff picks the actual airport/border later from the CRM.

/** Replaces the old hardcoded DESTINATION_COUNTRY_OPTIONS (Step 6.1, client-locked-spec roadmap) with the real Admin-managed Country list. */
async function getDestinationCountryOptions() {
  const countries = await db.country.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return countries.map((country) => ({ value: country.code, label: country.name }));
}

/**
 * The one function the bot engine calls each turn: given a service and
 * whatever's been collected so far, returns the NEXT field to ask about —
 * or null once every required field is in. Deliberately a pure function of
 * `collected` (no separate "current field" state needed): the engine calls
 * this once to generate a question, and again on the next inbound message
 * — since `collected` hasn't changed yet, it returns the SAME field, so the
 * engine knows exactly which field the new answer belongs to.
 */
export async function getNextField(serviceType: ServiceType, collected: Record<string, string>): Promise<NextField | null> {
  const has = (key: string) => key in collected;

  if (!has("fullName")) return textStep("fullName", "What's your full name?", NAME_VALIDATOR);
  if (!has("email")) return textStep("email", "What's your email address? We'll send updates there too.", EMAIL_VALIDATOR);

  switch (serviceType) {
    case "OTB": {
      if (!has("airline")) {
        return numberedChoiceStep(
          "airline",
          "Which airline is this for?",
          SAMPLE_AIRLINE_OPTIONS.map((option) => ({ value: option.label, label: option.label }))
        );
      }
      if (!has("travelDate")) return dateStep("travelDate", "What's your travel date?", otbRequestSchema.shape.travelDate);
      if (!has("processingType")) return numberedChoiceStep("processingType", "Normal or urgent processing?", PROCESSING_TYPE_OPTIONS);
      return null;
    }

    case "NEW_VISA": {
      if (!has("destinationCountry")) {
        return numberedChoiceStep("destinationCountry", "Which country is this visa for?", await getDestinationCountryOptions());
      }
      if (!has("visaType")) return numberedChoiceStep("visaType", "What type of visa do you need?", SAMPLE_VISA_TYPE_OPTIONS);
      if (!has("travelers")) return textStep("travelers", "How many travelers (1-9)?", newVisaRequestSchema.shape.travelers);
      if (!has("travelDate")) return dateStep("travelDate", "What's your planned travel date?", newVisaRequestSchema.shape.travelDate);
      if (!has("processingType")) return numberedChoiceStep("processingType", "Normal or urgent processing?", PROCESSING_TYPE_OPTIONS);
      return null;
    }

    case "VISA_EXTENSION": {
      if (!has("passportNumber")) return textStep("passportNumber", "What's your passport number?", visaExtensionRequestSchema.shape.passportNumber);
      if (!has("dob")) return dateStep("dob", "What's your date of birth?", visaExtensionBotFieldSchemas.dob);
      if (!has("insideUAE")) {
        return numberedChoiceStep("insideUAE", "Are you currently inside the UAE?", [
          { value: "yes", label: "Yes, I'm inside the UAE" },
          { value: "no", label: "No, I'm outside the UAE" },
        ]);
      }
      if (!has("entryDate")) return dateStep("entryDate", "What was your UAE entry date?", visaExtensionBotFieldSchemas.entryDate);
      return null;
    }

    case "VISA_CHANGE": {
      // Visa_Change.md §4/§5/§7/§14, Locked Rules #2/#3/#4/#6/#19: the
      // customer picks only the METHOD -- the actual airport/border is
      // staff-selected from the Admin master after the lead exists and
      // availability is confirmed. Never ask the customer to choose a
      // specific airport/border here.
      if (!has("changeType")) {
        return numberedChoiceStep("changeType", "Is this an Airport-to-Airport change or a Border Exit?", [
          { value: "AIRPORT_TO_AIRPORT", label: "Airport to Airport" },
          { value: "BORDER_EXIT", label: "Border Exit" },
        ]);
      }
      if (!has("passportNumber")) return textStep("passportNumber", "What's your passport number?", visaChangeRequestSchema.shape.passportNumber);
      if (!has("visaLastDate")) return dateStep("visaLastDate", "What's your current visa's last date?", visaChangeRequestSchema.shape.visaLastDate);
      if (!has("nationality")) return textStep("nationality", "What's your nationality?", visaChangeRequestSchema.shape.nationality);
      return null;
    }

    case "FLIGHT_SPECIAL_FARE": {
      if (!has("origin")) return textStep("origin", "Where are you flying from (city or airport)?", flightSpecialFareRequestSchema.shape.origin);
      if (!has("destination")) return textStep("destination", "Where are you flying to?", flightSpecialFareRequestSchema.shape.destination);
      if (!has("travelDate")) return dateStep("travelDate", "What's your travel date?", flightSpecialFareRequestSchema.shape.travelDate);
      if (!has("returnDate")) {
        return {
          fieldKey: "returnDate",
          prompt: "Do you have a return date? Reply with a date, or 'skip' if one-way.",
          parse: (raw) => {
            if (raw.trim().toLowerCase() === "skip") return { ok: true, value: "" };
            const iso = parseLooseDate(raw);
            if (!iso) return { ok: false, error: "Please enter a valid date, e.g. 25-12-2026, or reply 'skip'." };
            return { ok: true, value: iso };
          },
        };
      }
      // Bot captures only the primary passenger's DOB (no dynamic
      // "+Add Another Passenger" equivalent in the conversational flow,
      // same explicit simplification as Visa Change) -- enough to compute
      // their Adult/Child/Infant type per §7.
      if (!has("dob")) return dateStep("dob", "What's the passenger's date of birth?", flightPassengerSchema.shape.dob);
      return null;
    }

    case "RETURN_TICKET": {
      // Return_Verified_Ticket.md §5/§6/§10, locked: "Customer selects only
      // the travel date. The customer does not select the return/onward
      // date." -- never ask for it; it's computed server-side (see
      // buildLeadDetails()'s RETURN_TICKET case below and
      // src/lib/leads/compute-return-date.ts). This service is UAE-only
      // (§3), so there's no destination-country question either, unlike
      // New Visa/Visa Extension.
      if (!has("visaType")) {
        return numberedChoiceStep("visaType", "What's your UAE visa type?", [
          { value: "THIRTY_DAYS", label: "30 Days" },
          { value: "SIXTY_DAYS", label: "60 Days" },
        ]);
      }
      if (!has("travelDate")) return dateStep("travelDate", "What's your travel date?", returnTicketFieldsSchema.shape.travelDate);
      if (!has("travelers")) return textStep("travelers", "How many travelers (1-9)?", returnTicketFieldsSchema.shape.travelers);
      return null;
    }

    default:
      return null;
  }
}

/**
 * Strips bot-internal keys (like VISA_CHANGE's branch discriminant already
 * being the real `changeType` field — nothing to strip there) and shapes
 * `collected` into the `details` object createLeadFromSubmission expects,
 * matching each service's own lead route exactly. Async only because
 * RETURN_TICKET needs a DB read (the admin-configurable day-offset rule) to
 * compute the return date server-side — every other branch stays pure.
 */
export async function buildLeadDetails(serviceType: ServiceType, collected: Record<string, string>): Promise<Record<string, unknown>> {
  switch (serviceType) {
    case "OTB":
      return { airline: collected.airline, travelDate: collected.travelDate, processingType: collected.processingType };
    case "NEW_VISA":
      return {
        destinationCountry: collected.destinationCountry,
        visaType: collected.visaType,
        travelers: collected.travelers,
        travelDate: collected.travelDate,
        processingType: collected.processingType,
      };
    case "VISA_EXTENSION":
      return {
        passportNumber: collected.passportNumber,
        dob: collected.dob,
        insideUAE: collected.insideUAE,
        entryDate: collected.entryDate,
      };
    case "VISA_CHANGE":
      // Bot only ever captures the primary/single passenger (createLeadFromSubmission's
      // default fullName-derived passenger) -- no "+Add Another Passenger" equivalent
      // in the conversational flow, unlike the website. A reasonable, explicit
      // simplification, not a silent gap: staff can still see these raw answers.
      return {
        changeType: collected.changeType,
        passengers: [{ passportNumber: collected.passportNumber, visaLastDate: collected.visaLastDate }],
        nationality: collected.nationality,
      };
    case "FLIGHT_SPECIAL_FARE":
      // Bot captures only the primary passenger's DOB (no dynamic
      // "+Add Another Passenger" equivalent) -- kept in details for staff
      // visibility; not wired into the Passenger row's own dob/paxType
      // since engine.ts's lead-creation call doesn't build a custom
      // per-service passengers array for any service today (same
      // simplification already noted for Visa Change).
      return {
        origin: collected.origin,
        destination: collected.destination,
        travelDate: collected.travelDate,
        returnDate: collected.returnDate || undefined,
        passengerCount: 1,
        passengerDob: collected.dob,
      };
    case "RETURN_TICKET": {
      // Return_Verified_Ticket.md §5/§6, locked: the return/onward date is
      // never customer-entered (see the RETURN_TICKET question flow above,
      // which never asks for it) — computed here the same way the
      // website's /api/leads/return-ticket route does.
      const rules = await getReturnTicketRules();
      const returnDate = computeReturnDate(collected.travelDate, collected.visaType as ReturnTicketVisaType, rules);
      return {
        visaType: collected.visaType,
        travelDate: collected.travelDate,
        returnDate,
        travelers: collected.travelers,
      };
    }
    default:
      return {};
  }
}
