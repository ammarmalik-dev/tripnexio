import type { NextRequest } from "next/server";
import { updateAdminVendorSchema } from "@/lib/validation/admin-vendor-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

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

  const existing = await db.vendor.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Vendor not found.");

  const { services, ...vendorFields } = parsed.data;

  const updated = await db.$transaction(async (tx) => {
    if (services) {
      // Replace the vendor's service coverage wholesale — simpler and safer than
      // diffing add/remove, and this route is never called with a huge service list.
      await tx.vendorService.deleteMany({ where: { vendorId: id } });
      await tx.vendorService.createMany({ data: services.map((service) => ({ vendorId: id, service })) });
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
      note: `Vendor "${result.name}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
