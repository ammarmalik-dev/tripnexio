import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { revalidateQuotationSchema } from "@/lib/validation/quotation-schema";
import { revalidateQuotation } from "@/lib/quotations/revalidate-quotation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Business Rules §9 "Staff revalidation" — re-enables an expired quote's same payment link with a new validity window, instead of forcing a brand-new quote. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = revalidateQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const quotation = await db.quotation.findUnique({ where: { id }, include: { lead: true } });
  if (!quotation) return jsonError(404, "Quotation not found.");
  const scopeError = assertServiceAccess(session, quotation.lead.serviceType);
  if (scopeError) return scopeError;

  const result = await revalidateQuotation(id, parsed.data, { byUserId: session.id, label: `by ${session.name}` });
  if (!result.ok) {
    return jsonError(result.error === "Quotation not found." ? 404 : 409, result.error);
  }
  return jsonSuccess(result.quotation);
}
