import type { NextRequest } from "next/server";
import { vendorSubServicesSchema } from "@/lib/validation/vendor-service-rate-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { ServiceType } from "@/generated/prisma/enums";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { cleanSubServiceCodes } from "@/lib/vendors/sub-service-match";

interface RouteParams {
  params: Promise<{ id: string; service: string }>;
}

const SERVICE_TYPES = Object.values(ServiceType) as string[];

function isServiceType(value: string): value is ServiceType {
  return SERVICE_TYPES.includes(value);
}

const describe = (codes: readonly string[]) => (codes.length ? codes.join(", ") : "all sub-services");

/**
 * Admin handover §12 (client 2026-10-25) — which sub-services of one linked service a vendor
 * covers (none = all). Codes must belong to that service's SubService master. Reason required,
 * audited old → new. masters.manage only.
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

  const parsed = vendorSubServicesSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  try {
    const existing = await db.vendorService.findUnique({
      where: { vendorId_service: { vendorId: id, service } },
      include: { vendor: { select: { name: true } } },
    });
    if (!existing) return jsonError(404, "This vendor isn't linked to that service.");

    const master = await db.subService.findMany({ where: { serviceType: service }, select: { code: true } });
    const { codes, unknown } = cleanSubServiceCodes(
      parsed.data.subServiceCodes,
      master.map((row) => row.code)
    );
    if (unknown.length) {
      const message = `Not a sub-service of ${SERVICE_TYPE_LABELS[service]}: ${unknown.join(", ")}.`;
      return jsonError(400, message, { subServiceCodes: [message] });
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.vendorService.update({ where: { id: existing.id }, data: { subServiceCodes: codes } });
      await writeAudit(tx, {
        entityType: "Vendor",
        entityId: id,
        action: "SUB_SERVICES_UPDATE",
        byUserId: session.id,
        note: withReason(
          `Vendor "${existing.vendor.name}" ${SERVICE_TYPE_LABELS[service]} sub-services: ${describe(existing.subServiceCodes)} → ${describe(codes)} (by ${session.name})`,
          reason
        ),
      });
      return result;
    });

    return jsonSuccess(updated);
  } catch {
    return jsonError(500, "Couldn't update this vendor's sub-services. Please try again.");
  }
}
