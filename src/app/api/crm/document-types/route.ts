import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";

/**
 * Client testing 2026-10-09 (E10) — the active Document Master names, for the
 * CRM "add document" picker: staff choose a document from the master list
 * instead of typing a new name. Read-only; the master itself is managed in
 * Admin → Document Master.
 */
export async function GET() {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;
  try {
    const types = await db.documentType.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    return jsonSuccess(types);
  } catch (error) {
    console.error("[api/crm/document-types]", describeError(error));
    return jsonError(500, "Couldn't load the document list.");
  }
}
