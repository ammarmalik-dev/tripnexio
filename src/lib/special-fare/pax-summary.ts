import { computePaxType } from "../leads/pax-type";

export type PaxTypeLabel = "Adult" | "Child" | "Infant";

const LABEL = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" } as const;

/**
 * Client-side preview of a Special Fare passenger's type from DOB on the travel
 * date (the same `computePaxType` the server uses at submission; the server
 * value is the one stored). Null until both dates are filled in.
 */
export function previewPaxTypeLabel(dob: string | undefined, travelDate: string | undefined): PaxTypeLabel | null {
  if (!dob || !travelDate) return null;
  if (Number.isNaN(new Date(dob).getTime()) || Number.isNaN(new Date(travelDate).getTime())) return null;
  return LABEL[computePaxType(dob, travelDate)];
}

/**
 * "1 Adult · 1 Infant" — the passenger counts by type, in Adult / Child /
 * Infant order, skipping a type nobody is (client doc 2026-10-27, A2 summary).
 */
export function paxCountsLine(types: (PaxTypeLabel | null)[]): string {
  const parts: string[] = [];
  for (const label of ["Adult", "Child", "Infant"] as const) {
    const n = types.filter((type) => type === label).length;
    if (n > 0) parts.push(`${n} ${label}${n > 1 ? (label === "Child" ? "ren" : "s") : ""}`);
  }
  return parts.join(" · ");
}
