import type { PaxType } from "../../generated/prisma/enums";
import { ageBasisDate, ageInYears } from "./age";

/**
 * Flight_Special_Fare.md §7, locked: "DOB -> Age on Travel Date -> Passenger
 * Type. Adult: 12+, Child: 2-11, Infant: under 2." Computed server-side at
 * lead-creation time, never trusted from the client — matches the
 * never-trust-the-client pattern already used for margin/refundAmount/etc.
 * elsewhere in this codebase.
 */
export function computePaxType(dob: string, travelDate: string): PaxType {
  const age = ageInYears(dob, ageBasisDate(travelDate)) ?? Number.NaN;

  if (age < 2) return "INFANT";
  if (age < 12) return "CHILD";
  return "ADULT";
}

/**
 * New Visa has only Adult and Child (client correction 2026-10-05: "remove the
 * Infant option completely"), so a traveller under 2 is priced as a Child.
 */
export function computeNewVisaPaxType(dob: string, travelDate: string): PaxType {
  const paxType = computePaxType(dob, travelDate);
  return paxType === "INFANT" ? "CHILD" : paxType;
}
