import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { describeError } from "@/lib/api/describe-error";
import { passengerInputSchema } from "@/lib/validation/passenger-edit-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client doc 2026-10-20 (A4) — staff correct a traveller on a request they own (e.g. name a passenger the
 * WhatsApp bot recorded as "Child 1 (name to be confirmed)"); old → new values audited.
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
  const parsed = passengerInputSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const passenger = await db.passenger.findUnique({ where: { id } });
    if (!passenger) return jsonError(404, "Passenger not found.");
    const lead = await db.lead.findFirst({ where: { details: { path: ["passengerIds"], array_contains: id } }, select: { id: true, serviceType: true } });
    const booking = lead ? null : await db.booking.findFirst({ where: { passengers: { some: { passengerId: id } } }, select: { id: true, leadId: true, lead: { select: { serviceType: true } } } });
    const leadId = lead?.id ?? booking?.leadId;
    const serviceType = lead?.serviceType ?? booking?.lead.serviceType;
    if (!leadId || !serviceType) return jsonError(404, "This passenger isn't on a request you can edit.");
    const scopeError = assertServiceAccess(session, serviceType);
    if (scopeError) return scopeError;
    const ownershipError = await assertOwnsEntity(session, "lead", leadId);
    if (ownershipError) return ownershipError;

    const dob = parsed.data.dob ? new Date(`${parsed.data.dob}T00:00:00Z`) : null;
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.passenger.update({
        where: { id },
        data: { fullName: parsed.data.fullName, paxType: parsed.data.paxType, dob, passportNumber: parsed.data.passportNumber || null },
      });
      const changes = [
        passenger.fullName !== result.fullName ? `name ${passenger.fullName} -> ${result.fullName}` : null,
        passenger.paxType !== result.paxType ? `type ${passenger.paxType} -> ${result.paxType}` : null,
        (passenger.dob?.toISOString().slice(0, 10) ?? "") !== (result.dob?.toISOString().slice(0, 10) ?? "") ? "date of birth changed" : null,
        (passenger.passportNumber ?? "") !== (result.passportNumber ?? "") ? "passport number changed" : null,
      ].filter(Boolean);
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: leadId,
        action: "PASSENGER_UPDATED",
        byUserId: session.id,
        note: `Passenger ${result.fullName}: ${changes.join(", ") || "no change"} (by ${session.name})`,
      });
      return result;
    });
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/passengers/patch]", describeError(error));
    return jsonError(500, "Couldn't update the passenger.");
  }
}
