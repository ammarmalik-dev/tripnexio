import type { NextRequest } from "next/server";
import { createServiceSchema } from "@/lib/validation/service-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const services = await db.service.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(services);
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

  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.service.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return jsonError(400, "A service with this code already exists.", { code: ["This service already has a metadata row."] });
  }

  const service = await db.$transaction(async (tx) => {
    const created = await tx.service.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Service",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Service "${created.name}" (${created.code}) created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(service, 201);
}
