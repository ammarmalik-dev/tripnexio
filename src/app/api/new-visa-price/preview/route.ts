import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { computeNewVisaPrice } from "@/lib/new-visa/pricing";
import { computeNewVisaPaxType } from "@/lib/leads/pax-type";
import { getTaxFeeRates } from "@/lib/settings/tax-fee-config";
import type { PaxType } from "@/generated/prisma/enums";

const previewSchema = z.object({
  countryCode: z.string().min(1).max(40),
  newVisaConfigId: z.string().max(40).nullable().optional(),
  processingType: z.enum(["normal", "urgent"]),
  travelDate: z.string().min(1).max(20),
  travellers: z
    .array(z.object({ fullName: z.string().max(80), dob: z.string().max(20) }))
    .min(1)
    .max(9),
});

const roundToPaise = (value: number) => Math.round(value * 100) / 100;

/**
 * Public, unauthenticated — the New Visa summary step's price (P10):
 * passenger-wise lines (Adult / Child / Infant by age on the travel date),
 * GST and gateway fee from the Admin tax config, and the total — the same
 * pricing and rounding the payment itself uses, so the preview equals the
 * charged amount. `configured: false` when no price exists (never a guess).
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "new-visa-preview", { limit: 60, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the details.", parsed.error.flatten().fieldErrors);

  const paxTypes: PaxType[] = parsed.data.travellers.map((traveller) => computeNewVisaPaxType(traveller.dob, parsed.data.travelDate));
  const breakdown = await computeNewVisaPrice({
    countryCode: parsed.data.countryCode,
    newVisaConfigId: parsed.data.newVisaConfigId ?? null,
    processingType: parsed.data.processingType,
    travellerPaxTypes: paxTypes,
  });
  if (!breakdown) return jsonSuccess({ configured: false });

  const rateFor: Record<PaxType, number> = {
    ADULT: breakdown.ratePerType.adultPrice,
    CHILD: breakdown.ratePerType.childPrice,
    INFANT: breakdown.ratePerType.infantPrice,
  };
  const lines = parsed.data.travellers.map((traveller, index) => ({
    fullName: traveller.fullName,
    paxType: paxTypes[index],
    price: rateFor[paxTypes[index]],
  }));
  const { gstRate, gatewayFeeRate } = await getTaxFeeRates();
  const subtotal = breakdown.total;
  const gst = roundToPaise(subtotal * gstRate);
  const gatewayFee = roundToPaise(subtotal * gatewayFeeRate);

  return jsonSuccess({ configured: true, lines, subtotal, gst, gatewayFee, total: roundToPaise(subtotal + gst + gatewayFee) });
}
