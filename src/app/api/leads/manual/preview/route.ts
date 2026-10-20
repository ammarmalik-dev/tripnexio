import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { ServiceType, type ServiceType as ServiceTypeT } from "@/generated/prisma/enums";
import { manualLeadServiceDetails, previewManualLeadPrice } from "@/lib/leads/manual-lead-pricing";
import type { ManualLeadValues } from "@/lib/validation/manual-lead-schema";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];
const optionalText = z.string().trim().max(80).optional();

/** Only the fields that decide the price — the rest of the Manual Lead form needn't be filled yet. */
const previewSchema = z.object({
  serviceType: z.enum(serviceTypeValues),
  adultCount: z.number().int().min(1).max(20).catch(1),
  childCount: z.number().int().min(0).max(20).catch(0),
  infantCount: z.number().int().min(0).max(20).catch(0),
  couponCode: optionalText,
  extraCharges: z.number().min(0).max(1_000_000).optional(),
  destinationCountryCode: optionalText,
  newVisaConfigId: optionalText,
  nationalityId: optionalText,
  processingType: z.enum(["normal", "urgent"]).optional(),
  airlineCode: optionalText,
  returnTicketDestinationCountryId: optionalText,
});

/**
 * Client doc 2026-10-20 (K1) — the Manual Lead form's live price: the Admin-configured amount, the configured
 * invoice service fee, permitted extra charges (the configured amount is not a cap), coupon and the final
 * payable — exactly what the lead's payment link will carry. Quotation services say so instead.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) return jsonSuccess({ available: false, reason: "Choose the service first.", byQuotation: false });
  try {
    const data = { ...parsed.data, fullName: "", mobile: "", source: "Offline", travelDate: "" } as ManualLeadValues;
    const { preview } = await previewManualLeadPrice(data, await manualLeadServiceDetails(data));
    return jsonSuccess(preview);
  } catch (error) {
    console.error("[leads/manual/preview]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Couldn't work out the price. Please try again.");
  }
}
