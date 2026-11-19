import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { writeAudit } from "@/lib/audit/log";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { leadDetailsEditSchema } from "@/lib/validation/lead-details-edit-schema";
import { leadListFacts } from "@/lib/leads/list-facts";
import { describeError } from "@/lib/api/describe-error";
import type { Prisma } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Which form field writes which details key, per service (the same keys the intake routes store). */
function detailKeys(serviceType: string): Partial<Record<keyof ReturnType<typeof leadDetailsEditSchema.parse>, string>> {
  switch (serviceType) {
    case "FLIGHT_SPECIAL_FARE":
      return { travelDate: "travelDate", origin: "origin", destination: "destination", returnDate: "returnDate" };
    case "VISA_EXTENSION":
      return { visaExpiryDate: "visaExpiryDate" };
    case "VISA_CHANGE":
      return { visaExpiryDate: "visaLastDate" };
    case "RETURN_TICKET":
      return { travelDate: "travelDate", expectedReturnDate: "expectedReturnDate" };
    default:
      return { travelDate: "travelDate" };
  }
}

/**
 * Client doc 16 Nov (J11) — edit a manual lead's details (travel date, flight route / return date, visa expiry,
 * expected return date) until it is paid. Needs a reason; every change is audited old → new. Passengers are edited
 * in Applicants. Website / WhatsApp requests keep the customer's own submission.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const ownershipError = await assertOwnsEntity(session, "lead", id);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = leadDetailsEditSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;

  try {
    const lead = await db.lead.findUnique({
      where: { id },
      select: { id: true, serviceType: true, details: true, bookings: { select: { payments: { where: { status: "SUCCESS" }, select: { id: true } } } } },
    });
    if (!lead) return jsonError(404, "Lead not found.");
    const scopeError = assertServiceAccess(session, lead.serviceType);
    if (scopeError) return scopeError;
    const actionError = assertServiceAction(session, lead.serviceType, "EDIT");
    if (actionError) return actionError;
    const details = (lead.details ?? {}) as Record<string, unknown>;
    if (details.manualEntry !== true) return jsonError(409, "Only a manual lead's details can be edited here.");
    if (lead.bookings.some((booking) => booking.payments.length > 0)) return jsonError(409, "This lead is paid — its details can't be changed any more.");

    const keys = detailKeys(lead.serviceType);
    const next: Record<string, unknown> = { ...details };
    const changes: string[] = [];
    for (const [field, key] of Object.entries(keys) as [keyof typeof parsed.data, string][]) {
      const value = parsed.data[field];
      if (value === undefined) continue;
      const before = typeof details[key] === "string" ? (details[key] as string) : "";
      if (value === before) continue;
      if (value === "") delete next[key];
      else next[key] = value;
      changes.push(`${key}: ${before || "—"} -> ${value || "—"}`);
    }
    // A travel date is still required where the service has one.
    if ("travelDate" in keys && !next.travelDate) return jsonError(400, "Please check the highlighted fields.", { travelDate: ["Select a travel date"] });
    if (typeof next.returnDate === "string" && typeof next.travelDate === "string" && next.returnDate < next.travelDate) {
      return jsonError(400, "Please check the highlighted fields.", { returnDate: ["The return date must be on or after the travel date"] });
    }
    if (changes.length === 0) return jsonSuccess({ id, changed: false });

    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { details: next as Prisma.InputJsonObject, ...(await leadListFacts(tx, next, lead.serviceType)) },
      });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "DETAILS_UPDATED",
        byUserId: session.id,
        note: withReason(`Lead details edited — ${changes.join("; ")} (by ${session.name})`, reasonResult.reason),
      });
    });
    return jsonSuccess({ id, changed: true });
  } catch (error) {
    console.error("[api/leads/details] update failed", describeError(error));
    return jsonError(500, "Couldn't save the lead details.");
  }
}
