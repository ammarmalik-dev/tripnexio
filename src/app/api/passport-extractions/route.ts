import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

/** Scoped to one passenger — the CRM's Passengers & Documents section already knows the passenger ids it's rendering. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get("passengerId");
  if (!passengerId) return jsonError(400, "Provide a passengerId query parameter.");

  const extractions = await db.passportExtraction.findMany({
    where: { passengerId },
    orderBy: { createdAt: "desc" },
  });
  return jsonSuccess(extractions);
}
