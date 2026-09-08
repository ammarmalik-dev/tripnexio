import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Visa_Change.md §9/§10, Locked Rules #10-13: "Pickup Location — Mandatory
 * / Reporting Time — Mandatory / Pickup Person Name — Mandatory / Customer
 * Contact Number — Mandatory. The package must not be generated if
 * mandatory operational details are missing." All four are required
 * together in this schema (no `.optional()`) -- that IS the hard gate:
 * this route can only ever save a complete set, never a partial one, so
 * anything reading this data later (a future package-generation step) can
 * trust that if borderOperationalDetails exists at all, it's complete.
 * Package PDF generation itself is out of scope here (separate CRM-side
 * work, per the roadmap).
 */
const borderDetailsSchema = z.object({
  borderId: z.string().min(1, "Select a border crossing"),
  pickupLocation: z.string().trim().min(2, "Enter the pickup location").max(200),
  reportingTime: z.string().trim().min(1, "Enter the reporting time"),
  pickupPersonName: z.string().trim().min(2, "Enter the pickup person's name").max(80),
  customerContactNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid contact number"),
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
  if (lead.serviceType !== "VISA_CHANGE") {
    return jsonError(409, "This action only applies to Visa Change leads.");
  }

  const border = await db.border.findUnique({ where: { id: parsed.data.borderId } });
  if (!border || !border.active || !border.activeForVisaChange) {
    return jsonError(400, "Select a valid border crossing.", { borderId: ["This border crossing isn't available for Visa Change."] });
  }

  const existingDetails = (lead.details as Record<string, unknown>) ?? {};

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id },
      data: {
        details: {
          ...existingDetails,
          borderOperationalDetails: {
            borderId: parsed.data.borderId,
            borderName: border.name,
            pickupLocation: parsed.data.pickupLocation,
            reportingTime: parsed.data.reportingTime,
            pickupPersonName: parsed.data.pickupPersonName,
            customerContactNumber: parsed.data.customerContactNumber,
            confirmedByStaffId: session.id,
            confirmedAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });

    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "VISA_CHANGE_BORDER_DETAILS_CONFIRMED",
      byUserId: session.id,
      note: `Border operational details confirmed: ${border.name} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess({ leadId: updated.id, borderOperationalDetails: (updated.details as Record<string, unknown>).borderOperationalDetails });
}
