import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import type { Prisma } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const methodSchema = z.object({ changeType: z.enum(["AIRPORT_TO_AIRPORT", "BORDER_EXIT"]) });
const METHOD_LABELS = { AIRPORT_TO_AIRPORT: "Airport-to-Airport", BORDER_EXIT: "Border Exit" } as const;

/**
 * Client corrections 2026-10-05 §8 — CRM may switch a Visa Change lead
 * between Airport-to-Airport and Border Exit (with a reason). History is
 * kept: the previous method's operational details stay on the lead, and
 * its unselected quotation options (which carry the old method's details)
 * are expired so the customer can't pick one. Not allowed once a booking
 * exists — that record is already being processed on the old method.
 */
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
  const parsed = methodSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Select Airport-to-Airport or Border Exit.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;
  const { changeType } = parsed.data;

  const lead = await db.lead.findUnique({
    where: { id },
    select: { id: true, serviceType: true, details: true, bookings: { where: { status: { not: "CANCELLED" } }, select: { id: true } } },
  });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  if (lead.serviceType !== "VISA_CHANGE") return jsonError(409, "This action only applies to Visa Change leads.");
  if (lead.bookings.length > 0) return jsonError(409, "This lead already has a booking — the method can't be changed now.");

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const previous = details.changeType === "AIRPORT_TO_AIRPORT" || details.changeType === "BORDER_EXIT" ? details.changeType : null;
  if (previous === changeType) return jsonError(409, `This lead is already ${METHOD_LABELS[changeType]}.`);

  const expired = await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: {
        details: {
          ...details,
          changeType,
          methodHistory: [
            ...(Array.isArray(details.methodHistory) ? details.methodHistory : []),
            { from: previous, to: changeType, at: new Date().toISOString(), byStaffId: session.id, reason },
          ],
        } as unknown as Prisma.InputJsonValue,
      },
    });
    const { count } = await tx.quotation.updateMany({
      where: { leadId: id, isSelected: false, isExpired: false },
      data: { isExpired: true, validityExpiresAt: new Date() },
    });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "VISA_CHANGE_METHOD_CHANGED",
      byUserId: session.id,
      note: withReason(
        `Visa Change method ${previous ? METHOD_LABELS[previous] : "not set"} → ${METHOD_LABELS[changeType]}${count > 0 ? `; ${count} open quotation option(s) expired` : ""} (by ${session.name})`,
        reason
      ),
    });
    return count;
  });

  return jsonSuccess({ changeType, expiredQuotations: expired });
}
