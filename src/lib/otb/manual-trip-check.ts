import { db } from "../db";
import { isActiveProcessingType } from "../processing-types/get";
import { getOtbGlobalRules, resolveAirlineRules } from "./get-otb-rules";
import { otbUrgentAvailable } from "./pricing";
import { evaluateOtbTravelDate } from "./processing-rules";
import { getProcessingCalendar } from "../calendar/get-working-calendar";

/**
 * Client doc 16 Nov (C3) — a staff-created OTB lead follows the website's rules: an active destination country, an
 * airline that is live for OTB in that country (active + priced), an active processing type, and a travel date the
 * airline's TAT can still meet on the India + destination working calendar. Null = fine; else the field error.
 */
export async function manualOtbTripError(input: {
  destinationCountryCode?: string | null;
  airlineCode?: string | null;
  processingType?: string | null;
  travelDate?: string | null;
}): Promise<{ message: string; field: string } | null> {
  const countryCode = input.destinationCountryCode?.trim();
  if (!countryCode) return { message: "Select the destination country.", field: "destinationCountryCode" };
  const country = await db.country.findFirst({ where: { code: { equals: countryCode, mode: "insensitive" }, active: true }, select: { id: true } });
  if (!country) return { message: "That country isn't active.", field: "destinationCountryCode" };
  if (!input.airlineCode) return { message: "Select an airline.", field: "airlineCode" };
  const airline = await db.airline.findFirst({
    where: { code: input.airlineCode, active: true, otbPrices: { some: { active: true, countryId: country.id } } },
  });
  if (!airline) return { message: "That airline isn't live for OTB to this country.", field: "airlineCode" };
  const processingType = input.processingType === "urgent" ? "urgent" : input.processingType === "normal" ? "normal" : null;
  if (!processingType || !(await isActiveProcessingType("OTB", processingType))) return { message: "Select an available processing type.", field: "processingType" };
  if (!input.travelDate) return { message: "Select a travel date.", field: "travelDate" };
  const rules = resolveAirlineRules(airline, await getOtbGlobalRules(), await otbUrgentAvailable(airline.id, countryCode));
  const outcome = evaluateOtbTravelDate(input.travelDate, rules, new Date(), await getProcessingCalendar(countryCode));
  if (outcome.status === "BLOCKED") return { message: outcome.message ?? "That travel date can't be processed in time.", field: "travelDate" };
  if (!outcome.allowed.includes(processingType)) return { message: outcome.message ?? "That processing type can't meet this travel date.", field: "processingType" };
  return null;
}
