import type { NextRequest } from "next/server";
import { vendorServiceRateSchema } from "@/lib/validation/vendor-service-rate-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { diffSnapshots } from "@/lib/pricing/rule-history";
import { vendorRateSnapshot } from "@/lib/vendors/rate-history";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { ServiceType } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string; service: string }>;
}

const SERVICE_TYPES = Object.values(ServiceType) as string[];

function isServiceType(value: string): value is ServiceType {
  return SERVICE_TYPES.includes(value);
}

/**
 * P23 — ADMIN §12 "vendor cost/rate service-wise": set one vendor's internal
 * cost / rate / validity for one service it's already linked to. Writes a
 * VendorRateHistory row (old → new, who) and an audit row in the same
 * transaction. masters.manage only — these figures never reach a customer
 * or plain-staff API.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id, service } = await params;
  if (!isServiceType(service)) return jsonError(400, "Unknown service.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = vendorServiceRateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const existing = await db.vendorService.findUnique({
      where: { vendorId_service: { vendorId: id, service } },
      include: { vendor: { select: { name: true } } },
    });
    if (!existing) return jsonError(404, "This vendor isn't linked to that service.");

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.vendorService.update({
        where: { id: existing.id },
        data: {
          cost: parsed.data.cost,
          rate: parsed.data.rate,
          validFrom: parsed.data.validFrom ? new Date(`${parsed.data.validFrom}T00:00:00.000Z`) : null,
          validUntil: parsed.data.validUntil ? new Date(`${parsed.data.validUntil}T00:00:00.000Z`) : null,
        },
      });
      const { oldValues, newValues } = diffSnapshots(vendorRateSnapshot(existing), vendorRateSnapshot(result));
      await tx.vendorRateHistory.create({
        data: { vendorId: id, service, oldValues, newValues, userId: session.id },
      });
      await writeAudit(tx, {
        entityType: "Vendor",
        entityId: id,
        action: "RATE_UPDATE",
        byUserId: session.id,
        note: `Vendor "${existing.vendor.name}" ${SERVICE_TYPE_LABELS[service]} rate updated (by ${session.name})`,
      });
      return result;
    });

    return jsonSuccess(updated);
  } catch {
    return jsonError(500, "Couldn't update this vendor rate. Please try again.");
  }
}
