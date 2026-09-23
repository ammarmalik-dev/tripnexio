import type { NextRequest } from "next/server";
import { createAdminVendorSchema } from "@/lib/validation/admin-vendor-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const vendors = await db.vendor.findMany({
    orderBy: { name: "asc" },
    include: { services: { orderBy: { service: "asc" } } },
  });
  return jsonSuccess(vendors);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createAdminVendorSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const { services, ...vendorFields } = parsed.data;

  const vendor = await db.$transaction(async (tx) => {
    const created = await tx.vendor.create({
      data: {
        ...vendorFields,
        services: { create: services.map((service) => ({ service })) },
      },
      include: { services: true },
    });
    await writeAudit(tx, {
      entityType: "Vendor",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Vendor "${created.name}" (${services.join(", ")}) created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(vendor, 201);
}
