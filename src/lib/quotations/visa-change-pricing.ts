import { db } from "../db";
import type { PaxType } from "../../generated/prisma/enums";

export interface VisaChangeFeeLine {
  passengerId: string;
  fullName: string;
  nationality: string | null;
  paxType: PaxType;
  /** null when no `PricingRule` (specific-nationality or universal) covers this passenger. */
  rate: number | null;
}

export interface VisaChangeFeeSuggestion {
  /** true only when every passenger has a matching rate — never a partial/guessed total. */
  configured: boolean;
  total: number;
  lines: VisaChangeFeeLine[];
}

interface PassengerInput {
  id: string;
  fullName: string;
  nationality: string | null;
  paxType: PaxType;
}

/**
 * Admin FINAL handover's "pricing must support nationality-wise, adult-wise
 * and child-wise rates" for Visa Change (docs/TripNexio_Visa_Change_
 * Developer_Handover.docx §3) — reads the same central `PricingRule` table
 * every other auto-priced service already uses (Step 40), keyed by
 * `(VISA_CHANGE, nationality, paxType)`, `countryId`/`processingType` left
 * null since Visa Change has neither dimension in its locked spec. A
 * nationality-specific rule overrides a `nationality: null` universal one
 * for the same paxType, matching `PricingRule`'s own established
 * null-means-applies-to-everyone convention (Step 40/41).
 *
 * This only ever returns a *suggestion* for staff to review — it never
 * writes a Quotation itself. Visa Change quotes still go through the exact
 * same staff-entered `feeAmount` field as before; this just gives staff a
 * real, Admin-configured number to start from instead of guessing.
 */
export async function computeVisaChangeFeeSuggestion(passengers: PassengerInput[]): Promise<VisaChangeFeeSuggestion> {
  if (passengers.length === 0) return { configured: false, total: 0, lines: [] };

  const paxTypes = [...new Set(passengers.map((p) => p.paxType))];
  const nationalities = [...new Set(passengers.map((p) => p.nationality).filter((n): n is string => !!n))];

  const rules = await db.pricingRule.findMany({
    where: {
      serviceType: "VISA_CHANGE",
      countryId: null,
      processingType: null,
      paxType: { in: paxTypes },
      active: true,
      OR: [{ nationality: null }, { nationality: { in: nationalities } }],
    },
  });

  const ruleFor = (nationality: string | null, paxType: PaxType) =>
    (nationality ? rules.find((r) => r.nationality === nationality && r.paxType === paxType) : undefined) ??
    rules.find((r) => r.nationality === null && r.paxType === paxType);

  const lines: VisaChangeFeeLine[] = passengers.map((p) => {
    const rule = ruleFor(p.nationality, p.paxType);
    const rate = rule ? Number(rule.sellingPrice) + Number(rule.additionalCharges) : null;
    return { passengerId: p.id, fullName: p.fullName, nationality: p.nationality, paxType: p.paxType, rate };
  });

  const configured = lines.every((line) => line.rate !== null);
  const total = lines.reduce((sum, line) => sum + (line.rate ?? 0), 0);

  return { configured, total, lines };
}
