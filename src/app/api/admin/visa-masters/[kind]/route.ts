import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { isVisaMasterKind, VISA_MASTER_CONFIG, visaStayTypeSchema, visaValidityTypeSchema } from "@/lib/visa-masters/visa-masters";

interface RouteParams {
  params: Promise<{ kind: string }>;
}

/** Client corrections 2026-10-05 — list a visa master (Admin; masters.manage). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { kind } = await params;
  if (!isVisaMasterKind(kind)) return jsonError(404, "Not found.");
  const orderBy = [{ displayOrder: "asc" as const }, { name: "asc" as const }];
  const rows =
    kind === "stay-types"
      ? await db.visaStayType.findMany({ orderBy })
      : (await db.visaValidityType.findMany({ orderBy, include: { _count: { select: { products: true } } } })).map(({ _count, ...row }) => ({
          ...row,
          usedIn: _count.products,
        }));
  return jsonSuccess(rows);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { kind } = await params;
  if (!isVisaMasterKind(kind)) return jsonError(404, "Not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  try {
    const created = await db.$transaction(async (tx) => {
      let row: { id: string; name: string };
      if (kind === "stay-types") {
        const parsed = visaStayTypeSchema.safeParse(body);
        if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
        row = await tx.visaStayType.create({ data: parsed.data });
      } else {
        const parsed = visaValidityTypeSchema.safeParse(body);
        if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
        row = await tx.visaValidityType.create({ data: { ...parsed.data, description: parsed.data.description || null } });
      }
      await writeAudit(tx, {
        entityType: VISA_MASTER_CONFIG[kind].entityType,
        entityId: row.id,
        action: "CREATE",
        byUserId: session.id,
        note: `${VISA_MASTER_CONFIG[kind].label} "${row.name}" added (by ${session.name})`,
      });
      return { row };
    });
    if ("error" in created) return jsonError(400, "Please check the highlighted fields.", created.error);
    return jsonSuccess(created.row, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return jsonError(400, "That name or value already exists.", { name: ["Already in the list."] });
    }
    console.error("[api/admin/visa-masters] create failed", error);
    return jsonError(500, "Couldn't save. Please try again.");
  }
}
