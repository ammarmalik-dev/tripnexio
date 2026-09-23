import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { selectQuotation } from "@/lib/quotations/select-quotation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Selecting a quotation expires every other quotation on the same lead — the spec's "one active quotation" rule. */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const quotation = await db.quotation.findUnique({ where: { id }, include: { lead: true } });
  if (!quotation) return jsonError(404, "Quotation not found.");
  const scopeError = assertServiceAccess(session, quotation.lead.serviceType);
  if (scopeError) return scopeError;

  const result = await selectQuotation(id, { byUserId: session.id, label: `by ${session.name}` });
  if (!result.ok) {
    return jsonError(result.error === "Quotation not found." ? 404 : 409, result.error);
  }
  return jsonSuccess(result.quotation);
}
