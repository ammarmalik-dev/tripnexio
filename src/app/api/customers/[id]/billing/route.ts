import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { billingToDb, customerBillingSchema } from "@/lib/validation/customer-billing-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client corrections 2026-10-05 — staff edit a customer's invoice billing details from Customer 360 (audited). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = customerBillingSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const existing = await db.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonError(404, "Customer not found.");

  const data = billingToDb(parsed.data);
  await db.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data });
    await writeAudit(tx, {
      entityType: "Customer",
      entityId: id,
      action: "BILLING_DETAILS_UPDATED",
      byUserId: session.id,
      note: `Billing details updated (by ${session.name})`,
    });
  });
  return jsonSuccess(data);
}
