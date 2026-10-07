import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { writeAudit } from "@/lib/audit/log";
import { billingToDb, customerBillingSchema } from "@/lib/validation/customer-billing-schema";

/** Client corrections 2026-10-05 — the signed-in customer's own invoice billing details. */
export async function PATCH(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return jsonError(401, "Please log in.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = customerBillingSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const data = billingToDb(parsed.data);
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: session.id }, data });
      await writeAudit(tx, { entityType: "Customer", entityId: session.id, action: "BILLING_DETAILS_UPDATED", note: "Billing details updated by the customer" });
    });
    return jsonSuccess(data);
  } catch (error) {
    console.error("[api/account/billing] failed", describeError(error));
    return jsonError(500, "Couldn't save your billing details. Please try again.");
  }
}
