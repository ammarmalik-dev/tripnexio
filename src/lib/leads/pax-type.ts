import type { PaxType } from "../../generated/prisma/enums";

/**
 * Flight_Special_Fare.md §7, locked: "DOB -> Age on Travel Date -> Passenger
 * Type. Adult: 12+, Child: 2-11, Infant: under 2." Computed server-side at
 * lead-creation time, never trusted from the client — matches the
 * never-trust-the-client pattern already used for margin/refundAmount/etc.
 * elsewhere in this codebase.
 */
export function computePaxType(dob: string, travelDate: string): PaxType {
  const dobDate = new Date(dob);
  const travel = new Date(travelDate);

  let age = travel.getFullYear() - dobDate.getFullYear();
  const monthDiff = travel.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && travel.getDate() < dobDate.getDate())) {
    age--;
  }

  if (age < 2) return "INFANT";
  if (age < 12) return "CHILD";
  return "ADULT";
}
