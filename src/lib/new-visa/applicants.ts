import type { PaxType } from "../../generated/prisma/enums";

export interface ApplicantRow {
  passengerId: string | null;
  fullName: string;
  passportNumber: string | null;
  passportExpiry: string | null;
  dob: string | null;
  occupation: string | null;
  paxType: PaxType | null;
  guardianName: string | null;
  guardianPassport: string | null;
  guardianRelationship: string | null;
}

interface PassengerFacts {
  id: string;
  fullName: string;
  passportNumber: string | null;
  dob: Date | null;
  paxType: PaxType;
}

const text = (value: unknown) => (typeof value === "string" && value ? value : null);

/**
 * P11 — every applicant on a request for the CRM (Lead and Booking detail):
 * the applicant-wise record the New Visa form saves in Lead.details
 * (occupation, guardian, passport expiry), joined with the Passenger rows
 * (DOB, Adult/Child/Infant) through details.passengerIds, which is in the
 * same order. Other services fall back to the passengers alone.
 */
export function buildApplicantRows(details: unknown, passengers: PassengerFacts[]): ApplicantRow[] {
  const data = (details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(data.passengerIds) ? (data.passengerIds as string[]) : [];
  const applicants = Array.isArray(data.applicants) ? (data.applicants as Record<string, unknown>[]) : [];
  const byId = new Map(passengers.map((passenger) => [passenger.id, passenger]));

  if (applicants.length === 0) {
    const ordered = passengerIds.length > 0 ? passengerIds.map((id) => byId.get(id)).filter((p): p is PassengerFacts => !!p) : passengers;
    return ordered.map((passenger) => ({
      passengerId: passenger.id,
      fullName: passenger.fullName,
      passportNumber: passenger.passportNumber,
      passportExpiry: null,
      dob: passenger.dob ? passenger.dob.toISOString().slice(0, 10) : null,
      occupation: null,
      paxType: passenger.paxType,
      guardianName: null,
      guardianPassport: null,
      guardianRelationship: null,
    }));
  }

  return applicants.map((applicant, index) => {
    const passenger = byId.get(passengerIds[index] ?? "") ?? null;
    const guardian = (applicant.guardian ?? {}) as Record<string, unknown>;
    return {
      passengerId: passenger?.id ?? null,
      fullName: text(applicant.fullName) ?? passenger?.fullName ?? "",
      passportNumber: text(applicant.passportNumber) ?? passenger?.passportNumber ?? null,
      passportExpiry: text(applicant.passportExpiry),
      dob: passenger?.dob ? passenger.dob.toISOString().slice(0, 10) : text(applicant.dob),
      occupation: text(applicant.occupation),
      paxType: passenger?.paxType ?? null,
      guardianName: text(guardian.fullName),
      guardianPassport: text(guardian.passportNumber),
      guardianRelationship: text(guardian.relationship),
    };
  });
}
