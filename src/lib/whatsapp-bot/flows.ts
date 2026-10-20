import { z } from "zod";
import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import { otbRequestSchema } from "../validation/otb-schema";
import { newVisaRequestSchema } from "../validation/new-visa-schema";
import { visaExtensionRequestSchema } from "../validation/visa-extension-schema";
import { visaChangeRequestSchema } from "../validation/visa-change-schema";
import { flightSpecialFareRequestSchema } from "../validation/flight-special-fare-schema";
import { returnTicketFieldsSchema } from "../validation/return-ticket-schema";
import { getActiveVisaTypes } from "../visa-types/active-visa-types";
import { getProcessingTypeOptions } from "../processing-types/get";
import { getOtbGlobalRules, resolveAirlineRules } from "../otb/get-otb-rules";
import { otbUrgentAvailable } from "../otb/pricing";
import { evaluateOtbTravelDate } from "../otb/processing-rules";
import { getWorkingCalendar, getWorkingCalendarForCountry } from "../calendar/get-working-calendar";
import type { LeadPassengerInput } from "../leads/create-lead";
import { getNewVisaTravelRules } from "../new-visa/travel-rules";
import { allowedProcessingTypes, productLabel } from "../new-visa/products";
import { getNewVisaDestinations } from "../new-visa/destinations";
import { workingDaysBetween } from "../calendar/working-calendar";

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

/**
 * P23 — processing-type choices (codes + labels) from the Admin Processing
 * Types master, same source as the website forms: a code Admin disabled isn't
 * offered, and labels follow Admin edits (New Visa "Express", OTB "Urgent" by
 * default). Only the codes the request schemas accept are offered.
 */
async function getProcessingTypeChoices(serviceType: ServiceType): Promise<{ value: string; label: string }[]> {
  return (await getProcessingTypeOptions(serviceType))
    .filter((option) => option.code === "normal" || option.code === "urgent")
    .map((option) => ({ value: option.code, label: option.label }));
}

// getActiveAirportOptions/getActiveBorderOptions removed (Step 8,
// client-locked-spec roadmap) -- the customer never picks a specific
// airport/border, only the A2A-vs-Border method (see the VISA_CHANGE case
// below); staff picks the actual airport/border later from the CRM.


/**
 * Client doc 2026-10-14 — OTB airlines for the chosen destination: only those
 * Admin priced OTB for (country × airline), the same set the website offers.
 */
async function getOtbAirlineOptions(countryCode: string) {
  const airlines = await db.airline.findMany({
    where: { active: true, otbPrices: { some: { active: true, country: { code: { equals: countryCode, mode: "insensitive" } } } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  return airlines.map((airline) => ({ value: airline.code, label: airline.name }));
}

/**
 * The OTB timeline check the website's lead route enforces, for a collected
 * airline code: returns an evaluator for a travel date, or null when that
 * airline is no longer available for OTB.
 */
async function getOtbTravelDateEvaluator(airlineCode: string, countryCode: string | undefined) {
  const airline = await db.airline.findFirst({ where: { code: airlineCode, active: true } });
  if (!airline) return null;
  // Urgent depends on the destination's OTB price; before the destination is known only the timeline matters.
  const urgentAvailable = countryCode ? await otbUrgentAvailable(airline.id, countryCode) : true;
  const rules = resolveAirlineRules(airline, await getOtbGlobalRules(), urgentAvailable);
  const calendar = await getWorkingCalendar("INDIA");
  return (travelDate: string) => evaluateOtbTravelDate(travelDate, rules, new Date(), calendar);
}

/** "Delhi - Indira Gandhi International Airport (DEL)" — the same value the website's airport field stores. */
function airportValue(airport: { code: string; name: string; city: string }): string {
  return `${airport.city} - ${airport.name} (${airport.code})`;
}

/**
 * Client doc 2026-10-14 — a Special Fare airport over WhatsApp: an airport code,
 * airport name or city, matched against the active Airport master. One match is
 * taken (stored like the website value, so staff and quotes see the real airport);
 * several matches list them and ask for the code; anything else is refused.
 */
function airportStep(fieldKey: string, prompt: string, notSameAs?: string): NextField {
  return {
    fieldKey,
    prompt,
    parse: async (raw) => {
      const text = raw.trim();
      if (text.length < 2) return { ok: false, error: "Please reply with a city, airport name or airport code." };
      const exact = /^[a-z]{3}$/i.test(text) ? await db.airport.findFirst({ where: { active: true, code: text.toUpperCase() } }) : null;
      const matches = exact
        ? [exact]
        : await db.airport.findMany({
            where: {
              active: true,
              OR: [
                { city: { contains: text, mode: "insensitive" } },
                { name: { contains: text, mode: "insensitive" } },
                { code: { equals: text, mode: "insensitive" } },
              ],
            },
            orderBy: [{ city: "asc" }, { name: "asc" }],
            take: 8,
          });
      if (matches.length === 0) {
        return { ok: false, error: `We couldn't find an airport for "${text}". Please check the spelling, or reply with the airport code (e.g. DEL), or type "agent" for help.` };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          error: `Several airports match "${text}". Please reply with the code of your airport:\n${matches.map((airport) => `• ${airport.code} — ${airport.name}, ${airport.city}`).join("\n")}`,
        };
      }
      const value = airportValue(matches[0]);
      if (notSameAs && value === notSameAs) return { ok: false, error: "The destination must be a different airport from where you're flying." };
      return { ok: true, value };
    },
  };
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

// ---------------------------------------------------------------------------
// Client testing 2026-10-09 (C1-C4) — passenger count (Adult / Child / Infant)
// and each passenger's name + passport over chat, so New Visa / OTB / Return
// Ticket can be priced from Admin config and paid straight from the chat.
// ---------------------------------------------------------------------------

const PAX_KINDS = [
  { key: "adults", label: "Adult", prompt: "How many adults (12 years and above)?", min: 1 },
  { key: "children", label: "Child", prompt: "How many children (2-11 years)? Reply 0 if none.", min: 0 },
  { key: "infants", label: "Infant", prompt: "How many infants (under 2)? Reply 0 if none.", min: 0 },
] as const;

const MAX_PAX = 9;
const PASSPORT_VALIDATOR = visaExtensionRequestSchema.shape.passportNumber;
const PAX_LABELS = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" } as const;

function countValidator(min: number): z.ZodTypeAny {
  return z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "Please reply with a number, e.g. 1.")
    .refine((value) => Number(value) >= min && Number(value) <= MAX_PAX, `Please reply with a number from ${min} to ${MAX_PAX}.`);
}

/** The passengers so far, in Adult → Child → Infant order (only once all three counts are in). */
export interface BotPassenger {
  index: number;
  paxType: "ADULT" | "CHILD" | "INFANT";
  fullName?: string;
  passportNumber?: string;
  /** Visa Extension — the passenger's current visa expiry (client doc 2026-10-15). */
  visaExpiryDate?: string;
}

export function botPassengers(collected: Record<string, string>): BotPassenger[] {
  const counts = { ADULT: Number(collected.adults ?? 0), CHILD: Number(collected.children ?? 0), INFANT: Number(collected.infants ?? 0) };
  const list: BotPassenger[] = [];
  for (const paxType of ["ADULT", "CHILD", "INFANT"] as const) {
    for (let n = 0; n < counts[paxType]; n++) {
      const index = list.length + 1;
      list.push({
        index,
        paxType,
        fullName: collected[`pax${index}Name`],
        passportNumber: collected[`pax${index}Passport`],
        visaExpiryDate: collected[`pax${index}Expiry`],
      });
    }
  }
  return list;
}

/**
 * Next passenger question (counts, then each passenger's name and passport), or null when every passenger is complete.
 * `sameRateForAll` (OTB, Return Ticket — one rate for every passenger, client reply 2026-10-13) asks one passenger
 * count, kept in `adults`, instead of Adult / Child / Infant.
 */
function passengerStep(
  collected: Record<string, string>,
  withPassport: boolean,
  options: {
    /** OTB, Return Ticket, Visa Extension: one passenger count instead of Adult / Child / Infant. */
    sameRateForAll?: boolean;
    /** New Visa, Visa Change: Adult (18+) and Child only (client doc 2026-10-15). */
    noInfants?: boolean;
    /** Visa Extension: each passenger's visa expiry date (no DOB asked on WhatsApp). */
    withVisaExpiry?: boolean;
  } = {}
): NextField | null {
  const { sameRateForAll = false, noInfants = false, withVisaExpiry = false } = options;
  if (sameRateForAll) {
    if (!("adults" in collected)) return textStep("adults", `How many passengers? (1 to ${MAX_PAX})`, countValidator(1));
  } else {
    for (const kind of PAX_KINDS) {
      if (noInfants && kind.key === "infants") continue;
      const prompt = noInfants && kind.key === "adults" ? "How many adults (18 years and above)?" : noInfants && kind.key === "children" ? "How many children (under 18)? Reply 0 if none." : kind.prompt;
      if (!(kind.key in collected)) return textStep(kind.key, prompt, countValidator(kind.min));
    }
  }
  const total = Number(collected.adults ?? 0) + Number(collected.children ?? 0) + Number(collected.infants ?? 0);
  if (total > MAX_PAX) {
    return {
      fieldKey: "infants",
      prompt: `We can take up to ${MAX_PAX} passengers per request over chat. How many infants (under 2)?`,
      parse: () => ({ ok: false, error: `That's more than ${MAX_PAX} passengers in total — type "menu" to start again, or "agent" for help.` }),
    };
  }
  for (const passenger of botPassengers(collected)) {
    const label = sameRateForAll ? "" : ` (${PAX_LABELS[passenger.paxType]})`;
    if (!passenger.fullName) {
      if (passenger.index === 1) {
        return {
          fieldKey: "pax1Name",
          prompt: `Passenger 1${label} — full name as on the passport? Reply "same" if it's ${collected.fullName}.`,
          parse: (raw) => {
            const value = raw.trim().toLowerCase() === "same" ? collected.fullName : raw.trim();
            const result = NAME_VALIDATOR.safeParse(value);
            return result.success ? { ok: true, value } : { ok: false, error: result.error.issues[0]?.message ?? "Please type the full name." };
          },
        };
      }
      return textStep(`pax${passenger.index}Name`, `Passenger ${passenger.index}${label} — full name as on the passport?`, NAME_VALIDATOR);
    }
    if (withPassport && !passenger.passportNumber) {
      return textStep(`pax${passenger.index}Passport`, `Passport number of ${passenger.fullName}?`, PASSPORT_VALIDATOR);
    }
    if (withVisaExpiry && !passenger.visaExpiryDate) {
      // Client doc 2026-10-20 (D5) — the client's wording.
      return dateStep(`pax${passenger.index}Expiry`, `Visa Expiry Date* — ${passenger.fullName}`, visaExtensionRequestSchema.shape.visaExpiryDate);
    }
  }
  return null;
}

/** OTB destinations: the countries Admin priced OTB for, on any active airline (OTB is priced only per country × airline). */
async function getOtbDestinationOptions() {
  const priced = await db.otbPrice.findMany({
    where: { active: true, airline: { active: true }, country: { active: true } },
    distinct: ["countryId"],
    select: { country: { select: { code: true, name: true } } },
    orderBy: { country: { name: "asc" } },
  });
  return priced.map((row) => ({ value: row.country.code, label: row.country.name }));
}

/** Client doc 2026-10-20 (E5 / E8) — the New Visa destinations Admin made live, each once — the same list as the website. */
async function getNewVisaCountryOptions() {
  return (await getNewVisaDestinations()).map((country) => ({ value: country.code, label: country.name }));
}

/** New Visa products (stay × entry) Admin configured for the country; empty = price by the country-wide rules. */
async function getNewVisaProductOptions(countryCode: string) {
  const configs = await db.newVisaCountryConfig.findMany({
    where: { active: true, country: { code: countryCode, active: true } },
    orderBy: [{ stayDays: "asc" }, { createdAt: "asc" }],
  });
  return configs.map((config) => ({ value: config.id, label: productLabel(config) }));
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
      // Client doc 2026-10-14 — destination country first, then only the airlines enabled for it.
      if (!has("destinationCountry")) {
        return numberedChoiceStep("destinationCountry", "Which country are you travelling to?", await getOtbDestinationOptions());
      }
      if (!has("airline")) return numberedChoiceStep("airline", "Which airline is this for?", await getOtbAirlineOptions(collected.destinationCountry));
      // Same airline timeline rules the website's OTB route enforces.
      const evaluate = await getOtbTravelDateEvaluator(collected.airline, collected.destinationCountry);
      if (!evaluate) return numberedChoiceStep("airline", "That airline isn't available for OTB right now.", []);
      if (!has("travelDate")) {
        return dateStep("travelDate", "What's your travel date?", otbRequestSchema.shape.travelDate, (iso) => {
          const outcome = evaluate(iso);
          return outcome.status === "BLOCKED" ? outcome.message : null;
        });
      }
      if (!has("processingType")) {
        const outcome = evaluate(collected.travelDate);
        const options = (await getProcessingTypeChoices("OTB")).filter((option) => (outcome.allowed as string[]).includes(option.value));
        const header = outcome.message ? `${outcome.message}\nWhich processing type?` : "Which processing type?";
        return numberedChoiceStep("processingType", header, options);
      }
      return passengerStep(collected, true, { sameRateForAll: true });
    }

    case "NEW_VISA": {
      if (!has("destinationCountry")) {
        return numberedChoiceStep("destinationCountry", "Which country is this visa for?", await getNewVisaCountryOptions());
      }
      // Client doc 2026-10-20 (E7) — one line per option: Stay Duration · Entry Type · Visa Category.
      const products = await getNewVisaProductOptions(collected.destinationCountry);
      if (!has("newVisaConfigId") && products.length > 1) return numberedChoiceStep("newVisaConfigId", "Which visa do you need?", products);
      if (!has("visaType") && products.length === 0) {
        // Only for a destination without products (the category is part of a product); same as the website.
        const visaTypes = await getActiveVisaTypes(collected.destinationCountry);
        if (visaTypes.length > 0) {
          return numberedChoiceStep(
            "visaType",
            "What type of visa do you need?",
            visaTypes.map((visaType) => ({ value: visaType.id, label: visaType.name }))
          );
        }
      }
      // Client testing 2026-10-09 (C4) — travel date checked against the
      // Admin TAT (working days): a date too soon for Normal only offers
      // Express; too soon for both asks for a later date. Client doc 2026-10-20 (E10) — counted on the
      // destination's own calendar (weekend + holidays), as the website does.
      const rules = await getNewVisaTravelRules(collected.destinationCountry);
      const calendar = await getWorkingCalendarForCountry(collected.destinationCountry);
      const allowedFor = (iso: string) => allowedProcessingTypes(workingDaysBetween(iso, new Date(), calendar), rules);
      if (!has("travelDate")) {
        return dateStep("travelDate", "What's your expected travel date?", newVisaRequestSchema.shape.travelDate, (iso) =>
          allowedFor(iso).length === 0
            ? `That's too soon to process a visa — the earliest is ${rules.minTravelDaysExpress} working days from today with Express. Please send a later date.`
            : null
        );
      }
      if (!has("processingType")) {
        const allowed = allowedFor(collected.travelDate);
        const options = (await getProcessingTypeChoices("NEW_VISA")).filter((option) => (allowed as string[]).includes(option.value));
        const header = allowed.includes("normal") ? "Which processing type?" : "Normal processing can't meet this travel date — Express is available:";
        return numberedChoiceStep("processingType", header, options);
      }
      return passengerStep(collected, true, { noInfants: true });
    }

    case "VISA_EXTENSION": {
      // Client doc 2026-10-15 — inside / outside the UAE first (outside = New Visa only, handled by the
      // engine), then each passenger's name, passport number and visa expiry. No DOB on WhatsApp.
      if (!has("insideUAE")) {
        return numberedChoiceStep("insideUAE", "Are you currently inside the UAE?", [
          { value: "yes", label: "Yes, I'm inside the UAE" },
          { value: "no", label: "No, I'm outside the UAE" },
        ]);
      }
      if (collected.insideUAE === "no") return null;
      // Client doc 2026-10-20 (D5) — adults and children, then each passenger's name, passport and visa expiry.
      return passengerStep(collected, true, { noInfants: true, withVisaExpiry: true });
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
      // Client doc 2026-10-15 / 2026-10-20 (D5) — adults and children, then each passenger's name, passport and
      // visa expiry date (the first passenger's is the request's visa last date).
      const paxQuestion = passengerStep(collected, true, { noInfants: true, withVisaExpiry: true });
      if (paxQuestion) return paxQuestion;
      if (!has("visaLastDate") && !collected.pax1Expiry) return dateStep("visaLastDate", "Visa Expiry Date*", visaChangeRequestSchema.shape.visaLastDate);
      if (!has("nationalityId")) return nationalityStep();
      return null;
    }

    case "FLIGHT_SPECIAL_FARE": {
      // Client doc 2026-10-14 — airports only from the Airport master: a code, airport name or city;
      // the chosen airport's full name is confirmed in the next question.
      if (!has("origin")) return airportStep("origin", "Where are you flying from? Reply with a city, airport name or airport code (e.g. DEL).");
      if (!has("destination")) {
        return airportStep("destination", `✈️ From: ${collected.origin}\n\nWhere are you flying to? Reply with a city, airport name or airport code (e.g. DXB).`, collected.origin);
      }
      if (!has("travelDate")) {
        return dateStep("travelDate", `✈️ ${collected.origin}\n➡️ ${collected.destination}\n\nWhat's your travel date?`, flightSpecialFareRequestSchema.shape.travelDate);
      }
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
      // Client testing 2026-10-09 — passenger count by Adult / Child / Infant (fares are per type).
      for (const kind of PAX_KINDS) {
        if (!has(kind.key)) return textStep(kind.key, kind.prompt, countValidator(kind.min));
      }
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
      return passengerStep(collected, true, { sameRateForAll: true });
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
      // Same keys as the website's OTB route — priceLeadForDirectPayment() prices it from these.
      const evaluate = await getOtbTravelDateEvaluator(collected.airline, collected.destinationCountry);
      const applicants = botPassengers(collected).map((p) => ({ fullName: p.fullName, passportNumber: p.passportNumber, paxType: p.paxType }));
      return {
        destinationCountry: collected.destinationCountry,
        airline: collected.airline,
        travelDate: collected.travelDate,
        processingType: collected.processingType,
        travelers: String(applicants.length),
        ...(evaluate ? { workingDaysToTravel: evaluate(collected.travelDate).workingDays } : {}),
        applicants,
      };
    }
    case "NEW_VISA": {
      const applicants = botPassengers(collected).map((p) => ({ fullName: p.fullName, passportNumber: p.passportNumber, paxType: p.paxType }));
      return {
        destinationCountry: collected.destinationCountry,
        ...(collected.visaType ? { visaTypeId: collected.visaType } : {}),
        // One product for the country = that one (the chat only asks when there are several).
        ...(collected.newVisaConfigId
          ? { newVisaConfigId: collected.newVisaConfigId }
          : await (async () => {
              const products = await getNewVisaProductOptions(collected.destinationCountry);
              return products.length === 1 ? { newVisaConfigId: products[0].value } : {};
            })()),
        travelDate: collected.travelDate,
        processingType: collected.processingType,
        travelers: String(applicants.length),
        applicants,
      };
    }
    case "VISA_EXTENSION": {
      // Same applicant-wise shape as the website form (details.applicants, in passenger order).
      const applicants = botPassengers(collected).map((p) => ({ fullName: p.fullName ?? collected.fullName, passportNumber: p.passportNumber, visaExpiryDate: p.visaExpiryDate }));
      return {
        insideUAE: collected.insideUAE,
        passportNumber: applicants[0]?.passportNumber,
        visaExpiryDate: applicants[0]?.visaExpiryDate,
        applicants,
      };
    }
    case "VISA_CHANGE":
      // Bot only ever captures the primary/single passenger (createLeadFromSubmission's
      // default fullName-derived passenger) -- no "+Add Another Passenger" equivalent
      // in the conversational flow, unlike the website. A reasonable, explicit
      // simplification, not a silent gap: staff can still see these raw answers.
      return {
        changeType: collected.changeType,
        visaLastDate: collected.visaLastDate || collected.pax1Expiry,
        passengers: botPassengers(collected).map((p) => ({ fullName: p.fullName, passportNumber: p.passportNumber, visaLastDate: p.visaExpiryDate || collected.visaLastDate })),
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
        adultCount: Number(collected.adults ?? 1),
        childCount: Number(collected.children ?? 0),
        infantCount: Number(collected.infants ?? 0),
        passengerCount: Number(collected.adults ?? 1) + Number(collected.children ?? 0) + Number(collected.infants ?? 0),
      };
    case "RETURN_TICKET": {
      // Same keys as the website's Return Ticket route — priceLeadForDirectPayment() prices it from these.
      const destination = await db.returnTicketDestination.findFirst({
        where: { countryId: collected.destinationCountryId, active: true },
        include: { country: { select: { name: true } } },
      });
      const applicants = botPassengers(collected).map((p) => ({ fullName: p.fullName, passportNumber: p.passportNumber, paxType: p.paxType }));
      return {
        ...(destination ? { destinationCountry: destination.country.name } : {}),
        destinationCountryId: collected.destinationCountryId,
        travelDate: collected.travelDate,
        expectedReturnDate: collected.expectedReturnDate,
        travelers: String(applicants.length),
        applicants,
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
  if (serviceType === "OTB" || serviceType === "RETURN_TICKET" || serviceType === "NEW_VISA" || serviceType === "VISA_EXTENSION") {
    const list = botPassengers(collected);
    return list.length > 0
      ? list.map((p) => ({ fullName: p.fullName ?? collected.fullName, passportNumber: p.passportNumber, paxType: p.paxType }))
      : undefined;
  }
  // Client doc 2026-10-20 (A4) — a Special Fare request keeps one passenger per Adult / Child / Infant it was asked
  // for (the contact first; the others named by type until staff add their names), so fares and tickets
  // count every traveller — not a single adult.
  if (serviceType === "FLIGHT_SPECIAL_FARE") {
    const list = botPassengers(collected);
    if (list.length <= 1) return undefined;
    const typeLabel = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" } as const;
    const seen = { ADULT: 0, CHILD: 0, INFANT: 0 };
    return list.map((p, index) => {
      seen[p.paxType] += 1;
      return { fullName: index === 0 ? collected.fullName : `${typeLabel[p.paxType]} ${seen[p.paxType]} (name to be confirmed)`, paxType: p.paxType };
    });
  }
  if (serviceType !== "VISA_CHANGE") return undefined;
  const nationality = collected.nationalityId
    ? await db.nationality.findUnique({ where: { id: collected.nationalityId }, select: { id: true, name: true } })
    : null;
  const list = botPassengers(collected);
  return list.length > 0
    ? list.map((p) => ({ fullName: p.fullName ?? collected.fullName, passportNumber: p.passportNumber, nationality: nationality?.name, nationalityId: nationality?.id, paxType: p.paxType }))
    : undefined;
}

