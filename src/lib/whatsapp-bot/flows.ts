import { z } from "zod";
import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import { otbRequestSchema } from "../validation/otb-schema";
import { newVisaRequestSchema } from "../validation/new-visa-schema";
import { visaExtensionBotFieldSchemas, visaExtensionRequestSchema } from "../validation/visa-extension-schema";
import { visaChangeRequestSchema } from "../validation/visa-change-schema";
import { flightSpecialFareRequestSchema, flightPassengerSchema } from "../validation/flight-special-fare-schema";
import { returnTicketFieldsSchema } from "../validation/return-ticket-schema";
import { getActiveVisaTypes } from "../visa-types/active-visa-types";
import { getOtbGlobalRules, resolveAirlineRules } from "../otb/get-otb-rules";
import { evaluateOtbTravelDate } from "../otb/processing-rules";
import { getWorkingCalendar } from "../calendar/get-working-calendar";
import type { LeadPassengerInput } from "../leads/create-lead";

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

// New Visa's customer-facing wording is Normal / Express (UAE Visa Page
// Content FINAL §14); the stored value stays "urgent". OTB keeps "Urgent".
const NEW_VISA_PROCESSING_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Express" },
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

/** OTB airlines from the Airline master — the same active + OTB-required set the website offers. Stores the code. */
async function getOtbAirlineOptions() {
  const airlines = await db.airline.findMany({
    where: { active: true, otbRequired: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  return airlines.map((airline) => ({ value: airline.code, label: airline.name }));
}

/**
 * The OTB timeline check the website's lead route enforces, for a collected
 * airline code: returns an evaluator for a travel date, or null when that
 * airline is no longer available for OTB.
 */
async function getOtbTravelDateEvaluator(airlineCode: string) {
  const airline = await db.airline.findFirst({ where: { code: airlineCode, active: true, otbRequired: true } });
  if (!airline) return null;
  const rules = resolveAirlineRules(airline, await getOtbGlobalRules());
  const calendar = await getWorkingCalendar("INDIA");
  return (travelDate: string) => evaluateOtbTravelDate(travelDate, rules, new Date(), calendar);
}

/** Return Ticket destinations with an Admin-configured rate. Stores the Country id, like the website form. */
async function getReturnTicketDestinationOptions() {
  const destinations = await db.returnTicketDestination.findMany({
    where: { active: true, country: { active: true } },
    include: { country: { select: { name: true } } },
    orderBy: { country: { name: "asc" } },
  });
  return destinations.map((destination) => ({ value: destination.countryId, label: destination.country.name }));
}

/** Free-text nationality matched against the Nationality master (exact name, else a single name starting with it). */
function nationalityStep(): NextField {
  return {
    fieldKey: "nationalityId",
    prompt: "What's your nationality? (e.g. Indian)",
    parse: async (raw) => {
      const text = raw.trim();
      if (text.length < 2) return { ok: false, error: "Please type your nationality." };
      const exact = await db.nationality.findFirst({ where: { active: true, name: { equals: text, mode: "insensitive" } } });
      if (exact) return { ok: true, value: exact.id };
      const partial = await db.nationality.findMany({
        where: { active: true, name: { startsWith: text, mode: "insensitive" } },
        take: 5,
        orderBy: { name: "asc" },
      });
      if (partial.length === 1) return { ok: true, value: partial[0].id };
      if (partial.length > 1) return { ok: false, error: `Did you mean one of these? ${partial.map((n) => n.name).join(", ")}` };
      return { ok: false, error: "I couldn't find that nationality. Please check the spelling, or type \"agent\" for help." };
    },
  };
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
      if (!has("airline")) return numberedChoiceStep("airline", "Which airline is this for?", await getOtbAirlineOptions());
      // Same airline timeline rules the website's OTB route enforces.
      const evaluate = await getOtbTravelDateEvaluator(collected.airline);
      if (!evaluate) return numberedChoiceStep("airline", "That airline isn't available for OTB right now.", []);
      if (!has("travelDate")) {
        return dateStep("travelDate", "What's your travel date?", otbRequestSchema.shape.travelDate, (iso) => {
          const outcome = evaluate(iso);
          return outcome.status === "BLOCKED" ? outcome.message : null;
        });
      }
      if (!has("processingType")) {
        const outcome = evaluate(collected.travelDate);
        const options = PROCESSING_TYPE_OPTIONS.filter((option) => (outcome.allowed as string[]).includes(option.value));
        const header = outcome.message ? `${outcome.message}\nWhich processing type?` : "Normal or urgent processing?";
        return numberedChoiceStep("processingType", header, options);
      }
      return null;
    }

    case "NEW_VISA": {
      if (!has("destinationCountry")) {
        return numberedChoiceStep("destinationCountry", "Which country is this visa for?", await getDestinationCountryOptions());
      }
      if (!has("visaType")) {
        // Admin-managed per destination; skipped when none is configured (the website hides it too).
        const visaTypes = await getActiveVisaTypes(collected.destinationCountry);
        if (visaTypes.length > 0) {
          return numberedChoiceStep(
            "visaType",
            "What type of visa do you need?",
            visaTypes.map((visaType) => ({ value: visaType.id, label: visaType.name }))
          );
        }
      }
      if (!has("travelers")) return textStep("travelers", "How many travelers (1-9)?", newVisaRequestSchema.shape.travelers);
      if (!has("processingType")) return numberedChoiceStep("processingType", "Normal or Express processing?", NEW_VISA_PROCESSING_TYPE_OPTIONS);
      // No per-traveller passport/DOB/occupation over chat: the engine sends
      // the prefilled website request link instead (see newVisaRequestLink).
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
      if (!has("nationalityId")) return nationalityStep();
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
      // Client update (2026-09-24): no visa-type selection — the customer
      // gives an Expected Return Date instead (a target, not the actual
      // issued date — see buildLeadDetails()'s RETURN_TICKET case below).
      // The destination is asked first: its Admin-configured rate prices
      // the pay link, the same as the website form (P06).
      if (!has("destinationCountryId")) {
        return numberedChoiceStep("destinationCountryId", "Which country are you travelling to?", await getReturnTicketDestinationOptions());
      }
      if (!has("travelDate")) return dateStep("travelDate", "What's your travel date?", returnTicketFieldsSchema.shape.travelDate);
      if (!has("expectedReturnDate")) {
        return dateStep(
          "expectedReturnDate",
          "What's your expected return date? We'll aim to issue a ticket close to it, subject to availability.",
          returnTicketFieldsSchema.shape.expectedReturnDate,
          (iso) => (iso < collected.travelDate ? "Your expected return date should be on or after your travel date." : null)
        );
      }
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
 * matching each service's own lead route exactly. Kept `async` (every
 * branch is actually pure/sync today) so engine.ts's existing `await` call
 * needs no change if a future branch ever needs a real DB read again.
 */
export async function buildLeadDetails(serviceType: ServiceType, collected: Record<string, string>): Promise<Record<string, unknown>> {
  switch (serviceType) {
    case "OTB": {
      // Same shape and price basis as the website's OTB route (one applicant over chat).
      const airline = await db.airline.findFirst({ where: { code: collected.airline, active: true, otbRequired: true } });
      const evaluate = await getOtbTravelDateEvaluator(collected.airline);
      const unitPrice = airline ? Number(collected.processingType === "urgent" ? airline.urgentPrice : airline.normalPrice) : Number.NaN;
      return {
        airline: collected.airline,
        travelDate: collected.travelDate,
        processingType: collected.processingType,
        travelers: "1",
        ...(evaluate ? { workingDaysToTravel: evaluate(collected.travelDate).workingDays } : {}),
        ...(Number.isFinite(unitPrice) && unitPrice > 0 ? { ratePerApplicant: unitPrice, indicativeTotal: unitPrice } : {}),
      };
    }
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
      // Same shape and price basis as the website's /api/leads/return-ticket
      // route. Client update (2026-09-24): expectedReturnDate is the
      // customer's own target — the issued ticket date is a separate,
      // staff/availability-determined outcome, never computed here.
      const destination = await db.returnTicketDestination.findFirst({
        where: { countryId: collected.destinationCountryId, active: true },
        include: { country: { select: { name: true } } },
      });
      const travelers = Number(collected.travelers) || 1;
      const rate = destination ? Number(destination.ratePerApplicant) : Number.NaN;
      return {
        ...(destination ? { destinationCountry: destination.country.name } : {}),
        destinationCountryId: collected.destinationCountryId,
        travelDate: collected.travelDate,
        expectedReturnDate: collected.expectedReturnDate,
        travelers: collected.travelers,
        ...(Number.isFinite(rate) && rate > 0 ? { ratePerApplicant: rate, indicativeTotal: rate * travelers } : {}),
      };
    }
    default:
      return {};
  }
}

/**
 * The bot's Passenger rows, when it knows more than the contact name.
 * Visa Change links the picked nationality so pricing and document rules
 * match it; every other service uses the default single passenger.
 */
export async function buildLeadPassengers(
  serviceType: ServiceType,
  collected: Record<string, string>
): Promise<LeadPassengerInput[] | undefined> {
  if (serviceType !== "VISA_CHANGE" || !collected.nationalityId) return undefined;
  const nationality = await db.nationality.findUnique({ where: { id: collected.nationalityId }, select: { id: true, name: true } });
  return [
    {
      fullName: collected.fullName,
      passportNumber: collected.passportNumber,
      nationality: nationality?.name,
      nationalityId: nationality?.id,
      paxType: "ADULT",
    },
  ];
}

/** New Visa over chat ends with the website form, prefilled with what the customer already told the bot. */
export function newVisaRequestLink(siteUrl: string, collected: Record<string, string>): string {
  const params = new URLSearchParams();
  if (collected.destinationCountry) params.set("country", collected.destinationCountry);
  if (collected.visaType) params.set("visaType", collected.visaType);
  if (collected.processingType) params.set("processingType", collected.processingType);
  if (collected.travelers) params.set("travelers", collected.travelers);
  return `${siteUrl}/services/new-visa/request?${params.toString()}`;
}
