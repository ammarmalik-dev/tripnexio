import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import type { Prisma } from "@/generated/prisma/client";
import type { BorderBlock } from "@/lib/visa-change/operational";

const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid contact number");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

/**
 * Visa_Change.md §9/§10, Locked Rules #10-13. Mandatory (§9): border,
 * pickup location, reporting time, departure/travel time, customer contact
 * number, pickup person name. Optional: pickup person contact, drop
 * location, bus/operator, vendor/sponsor, instructions. The route only ever
 * saves a complete set, so a saved block is always package-ready (P14).
 */
const borderDetailsSchema = z.object({
  borderId: z.string().min(1, "Select a border crossing"),
  pickupLocation: z.string().trim().min(2, "Enter the pickup location").max(200),
  reportingTime: z.string().trim().min(1, "Enter the reporting time").max(40),
  travelTime: z.string().trim().min(1, "Enter the departure/travel time").max(40),
  pickupPersonName: z.string().trim().min(2, "Enter the pickup person's name").max(80),
  customerContactNumber: phone,
  pickupPersonContact: z.union([phone, z.literal("")]).optional().transform((value) => (value ? value : null)),
  dropLocation: optionalText(200),
  busOperator: optionalText(120),
  vendorId: optionalText(40),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = borderDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  if (lead.serviceType !== "VISA_CHANGE") {
    return jsonError(409, "This action only applies to Visa Change leads.");
  }

  const border = await db.border.findUnique({ where: { id: parsed.data.borderId } });
  if (!border || !border.active || !border.activeForVisaChange) {
    return jsonError(400, "Select a valid border crossing.", { borderId: ["This border crossing isn't available for Visa Change."] });
  }
  const vendor = parsed.data.vendorId ? await db.vendor.findUnique({ where: { id: parsed.data.vendorId } }) : null;
  if (parsed.data.vendorId && (!vendor || !vendor.active)) {
    return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
  }

  const block: BorderBlock = {
    kind: "BORDER",
    borderId: border.id,
    borderName: border.name,
    pickupLocation: parsed.data.pickupLocation,
    pickupPersonName: parsed.data.pickupPersonName,
    pickupPersonContact: parsed.data.pickupPersonContact,
    customerContactNumber: parsed.data.customerContactNumber,
    reportingTime: parsed.data.reportingTime,
    travelTime: parsed.data.travelTime,
    dropLocation: parsed.data.dropLocation,
    busOperator: parsed.data.busOperator,
    vendorId: vendor?.id ?? null,
    vendorName: vendor?.name ?? null,
    instructions: parsed.data.instructions,
  };
  const existingDetails = (lead.details as Record<string, unknown>) ?? {};

  try {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id },
        data: {
          details: {
            ...existingDetails,
            borderOperationalDetails: { ...block, confirmedByStaffId: session.id, confirmedAt: new Date().toISOString() },
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "VISA_CHANGE_BORDER_DETAILS_CONFIRMED",
        byUserId: session.id,
        note: `Border operational details confirmed: ${border.name}, reporting ${block.reportingTime}, travel ${block.travelTime} (by ${session.name})`,
      });

      return result;
    });

    return jsonSuccess({ leadId: updated.id, borderOperationalDetails: (updated.details as Record<string, unknown>).borderOperationalDetails });
  } catch (error) {
    console.error("[leads/visa-change-border-details]", error);
    return jsonError(500, "Couldn't save the border details. Please try again.");
  }
}
