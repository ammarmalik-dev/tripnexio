import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";

/**
 * Client doc 16 Nov (G4) — the active Document Master list (name + description) for staff who request documents: the
 * additional documents are picked from it, never typed freely. Read-only; Admin manages the list (Admin → Document Master).
 */
export async function GET() {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;
  try {
    const types = await db.documentType.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true },
    });
    return jsonSuccess(types);
  } catch (error) {
    console.error("[api/document-types]", describeError(error));
    return jsonError(500, "Couldn't load the document list.");
  }
}
