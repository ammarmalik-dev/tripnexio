import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import type { Prisma } from "@/generated/prisma/client";
import { borderQuoteBlock, leadOperationalBlock, parseOperationalBlock, type BorderBlock } from "@/lib/visa-change/operational";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid contact number");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

/**
 * Client doc 2026-10-20 (D8) — a Border Exit booking's trip details, entered after payment from the vendor
 * (every vendor has its own): pickup location, vehicle number, reporting and travel time, pickup person and
 * their contact, instructions. The border itself comes from the paid option (quotation). No customer contact
 * number, drop / border location, bus operator or vendor fields any more. Printed on the package PDF.
 */
const borderTripSchema = z.object({
  pickupLocation: z.string().trim().min(2, "Enter the pickup location").max(200),
  vehicleNumber: optionalText(40),
  reportingTime: z.string().trim().min(1, "Enter the reporting time").max(40),
  travelTime: z.string().trim().min(1, "Enter the departure/travel time").max(40),
  pickupPersonName: z.string().trim().min(2, "Enter the pickup person's name").max(80),
  pickupPersonContact: z.union([phone, z.literal("")]).optional().transform((value) => (value ? value : null)),
  instructions: optionalText(1500),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "lead", id);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = borderTripSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const lead = await db.lead.findUnique({ where: { id }, include: { quotations: { where: { isSelected: true }, take: 1 } } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  if (lead.serviceType !== "VISA_CHANGE") return jsonError(409, "This action only applies to Visa Change leads.");

  // The border of the paid option (or, for an older lead, the one saved on it).
  const quoteBlock = parseOperationalBlock(lead.quotations[0]?.operationalBlock);
  const legacy = leadOperationalBlock(lead.details);
  const borderSource = quoteBlock?.kind === "BORDER" ? quoteBlock : legacy?.kind === "BORDER" ? legacy : null;
  if (!borderSource) return jsonError(409, "Select a Border Exit option (with its border) first.");
  const border = await db.border.findUnique({ where: { id: borderSource.borderId }, include: { country: { select: { name: true } } } });
  const base = border ? borderQuoteBlock(border) : { kind: "BORDER" as const, borderId: borderSource.borderId, borderName: borderSource.borderName, borderCountryName: borderSource.borderCountryName ?? null };

  const block: BorderBlock = { ...base, ...parsed.data };
  const existingDetails = (lead.details as Record<string, unknown>) ?? {};
  try {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id },
        data: {
          details: { ...existingDetails, borderOperationalDetails: { ...block, confirmedByStaffId: session.id, confirmedAt: new Date().toISOString() } } as unknown as Prisma.InputJsonValue,
        },
      });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "VISA_CHANGE_BORDER_DETAILS_CONFIRMED",
        byUserId: session.id,
        note: `Border trip details saved: ${block.borderName}, pickup ${block.pickupLocation}, reporting ${block.reportingTime}, travel ${block.travelTime} (by ${session.name})`,
      });
      return result;
    });
    return jsonSuccess({ leadId: updated.id, borderOperationalDetails: (updated.details as Record<string, unknown>).borderOperationalDetails });
  } catch (error) {
    console.error("[leads/visa-change-border-details]", error);
    return jsonError(500, "Couldn't save the border details. Please try again.");
  }
}
