import type { NextRequest } from "next/server";
import { createProcessingTypeSchema, serviceTypeSchema } from "@/lib/validation/sub-service-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/** P23 — Admin processing-type master. `?serviceType=OTB` narrows the list. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const rawService = request.nextUrl.searchParams.get("serviceType");
    let serviceType: ReturnType<typeof serviceTypeSchema.parse> | undefined;
    if (rawService) {
      const parsed = serviceTypeSchema.safeParse(rawService);
      if (!parsed.success) return jsonError(400, "Unknown service type.", { serviceType: ["Unknown service type."] });
      serviceType = parsed.data;
    }
    const rows = await db.processingTypeOption.findMany({
      where: serviceType ? { serviceType } : undefined,
      orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }, { label: "asc" }],
    });
    return jsonSuccess(rows);
  } catch {
    return jsonError(500, "Couldn't load processing types.");
  }
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

  const parsed = createProcessingTypeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const duplicate = await db.processingTypeOption.findUnique({
      where: { serviceType_code: { serviceType: parsed.data.serviceType, code: parsed.data.code } },
    });
    if (duplicate) return jsonError(400, "This code is already used for this service.", { code: ["Already used for this service."] });

    const created = await db.$transaction(async (tx) => {
      const row = await tx.processingTypeOption.create({ data: parsed.data });
      await writeAudit(tx, {
        entityType: "ProcessingTypeOption",
        entityId: row.id,
        action: "CREATE",
        byUserId: session.id,
        note: `Processing type "${row.label}" (${row.serviceType}/${row.code}) added (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(created, 201);
  } catch {
    return jsonError(500, "Couldn't create this processing type.");
  }
}
