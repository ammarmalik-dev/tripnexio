import type { NextRequest } from "next/server";
import { updateAdminVendorSchema } from "@/lib/validation/admin-vendor-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateAdminVendorSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const existing = await db.vendor.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Vendor not found.");

  const { services, ...vendorFields } = parsed.data;

  const updated = await db.$transaction(async (tx) => {
    if (services) {
      // P23 — diff, don't replace: an unchanged service keeps its existing
      // VendorService row (and with it that service's cost/rate/validity).
      // Only services actually removed are deleted, only new ones created.
      const current = await tx.vendorService.findMany({ where: { vendorId: id }, select: { service: true } });
      const currentSet = new Set(current.map((row) => row.service));
      const nextSet = new Set(services);
      const removed = [...currentSet].filter((service) => !nextSet.has(service));
      const added = [...nextSet].filter((service) => !currentSet.has(service));
      if (removed.length) await tx.vendorService.deleteMany({ where: { vendorId: id, service: { in: removed } } });
      if (added.length) await tx.vendorService.createMany({ data: added.map((service) => ({ vendorId: id, service })) });
    }
    const result = await tx.vendor.update({
      where: { id },
      data: vendorFields,
      include: { services: { orderBy: { service: "asc" } } },
    });
    await writeAudit(tx, {
      entityType: "Vendor",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: withReason(`Vendor "${result.name}" updated (by ${session.name})`, reason),
    });
    return result;
  });

  return jsonSuccess(updated);
}
