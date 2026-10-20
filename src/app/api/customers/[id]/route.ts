import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { loadCustomer360 } from "@/lib/customers/customer-360";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { readBodyReason, readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { findCustomerByMobile } from "@/lib/customers/find-by-mobile";
import { createTask } from "@/lib/tasks/create-task";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * CRM.md §23 — Customer 360 (profile, leads, bookings, passengers,
 * quotations, payments, refunds, documents, communications, follow-up
 * tasks, timeline). Gated by `leads.view`; each operational section is
 * additionally gated by its own view permission inside loadCustomer360
 * (null when the role lacks it). Service-scoped staff get 403 for a
 * customer with no lead in their allowed services.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const result = await loadCustomer360(auth.session, id);
    if (result.kind === "not_found") return jsonError(404, "Customer not found.");
    if (result.kind === "forbidden") return jsonError(403, "You don't have access to this customer's services.");
    return jsonSuccess(result.data);
  } catch (error) {
    console.error("GET /api/customers/[id] failed", error);
    return jsonError(500, "Couldn't load this customer. Please try again.");
  }
}

/** Client doc 2026-10-20 (L4) — staff correct a customer's name, email and mobile from CRM (reason + audit). */
const customerEditSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name").max(120),
  email: z.union([z.string().trim().toLowerCase().email("Enter a valid email address").max(120), z.literal("")]),
  mobile: z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
});

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
  const reason = readBodyReason(body);
  if (reason.error) return reason.error;
  const parsed = customerEditSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const access = await loadCustomer360(session, id);
    if (access.kind === "not_found") return jsonError(404, "Customer not found.");
    if (access.kind === "forbidden") return jsonError(403, "You don't have access to this customer's services.");
    const before = await db.customer.findUniqueOrThrow({ where: { id }, select: { name: true, email: true, mobile: true } });
    const { name, email, mobile } = parsed.data;
    if (email && email !== before.email?.toLowerCase()) {
      const taken = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
      if (taken) return jsonError(409, "That email belongs to another customer.", { email: ["Already used by another customer."] });
    }
    if (mobile !== before.mobile) {
      const existing = await findCustomerByMobile(db, mobile);
      if (existing && existing.id !== id) return jsonError(409, "That mobile number belongs to another customer.", { mobile: ["Already used by another customer."] });
    }
    const changes = [
      name !== before.name ? `name ${before.name} -> ${name}` : null,
      (email || null) !== (before.email ?? null) ? `email ${before.email ?? "—"} -> ${email || "—"}` : null,
      mobile !== before.mobile ? `mobile ${before.mobile} -> ${mobile}` : null,
    ].filter(Boolean);
    if (changes.length === 0) return jsonSuccess({ id, name, email: before.email, mobile });
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.customer.update({ where: { id }, data: { name, email: email || null, mobile } });
      await writeAudit(tx, {
        entityType: "Customer",
        entityId: id,
        action: "CUSTOMER_UPDATED",
        byUserId: session.id,
        note: withReason(`Customer details changed: ${changes.join("; ")} (by ${session.name})`, reason.reason),
      });
      return result;
    });
    return jsonSuccess({ id: updated.id, name: updated.name, email: updated.email, mobile: updated.mobile });
  } catch (error) {
    console.error("PATCH /api/customers/[id] failed", error instanceof Error ? error.message : "error");
    return jsonError(500, "Couldn't save the customer. Please try again.");
  }
}

/**
 * Client doc 2026-10-20 (L4) — staff delete a customer's account from CRM, the same way the customer can
 * (client doc 2026-10-15, J7): the login is removed and every session ends; bookings, payments and invoices
 * stay as the law requires, and a task asks the team to remove anything else. Managers / Admin only.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.reassign");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const reason = await readDeleteReason(request);
  if (reason.error) return reason.error;

  try {
    const access = await loadCustomer360(session, id);
    if (access.kind === "not_found") return jsonError(404, "Customer not found.");
    if (access.kind === "forbidden") return jsonError(403, "You don't have access to this customer's services.");
    const customer = await db.customer.findUniqueOrThrow({ where: { id }, select: { name: true, accountDeletedAt: true } });
    if (customer.accountDeletedAt) return jsonError(409, "This account is already deleted.");
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { passwordHash: null, accountDeletedAt: new Date() } });
      await writeAudit(tx, {
        entityType: "Customer",
        entityId: id,
        action: "ACCOUNT_DELETED",
        byUserId: session.id,
        note: withReason(`Account deleted from CRM: login removed, records kept as legally required (by ${session.name})`, reason.reason),
      });
      await createTask(tx, {
        type: "MANUAL_VERIFICATION",
        priority: "HIGH",
        title: `Account deleted: ${customer.name}`,
        reason: "The account was deleted from CRM. Remove any personal data not needed for legal / tax records (bookings, payments and invoices stay).",
        entityType: "Customer",
        entityId: id,
      });
    });
    return jsonSuccess({ id, deleted: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id] failed", error instanceof Error ? error.message : "error");
    return jsonError(500, "Couldn't delete this account. Please try again.");
  }
}
