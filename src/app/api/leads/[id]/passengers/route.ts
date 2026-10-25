import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { describeError } from "@/lib/api/describe-error";
import { passengerInputSchema } from "@/lib/validation/passenger-edit-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client doc 2026-10-20 (A4) — staff add a traveller who's missing from a request (e.g. a WhatsApp Special
 * Fare request for 1 Adult + 1 Child + 1 Infant that came in with only the contact): the passenger joins the
 * lead and its open bookings, so fares, documents and tickets count everyone. Audited.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
  const parsed = passengerInputSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const lead = await db.lead.findUnique({ where: { id }, select: { id: true, customerId: true, serviceType: true, details: true, paxCount: true, bookings: { select: { id: true, status: true } } } });
    if (!lead) return jsonError(404, "Lead not found.");
    const scopeError = assertServiceAccess(session, lead.serviceType);
    if (scopeError) return scopeError;
    const actionError = assertServiceAction(session, lead.serviceType, "EDIT");
    if (actionError) return actionError;

    const passenger = await db.$transaction(async (tx) => {
      const created = await tx.passenger.create({
        data: {
          customerId: lead.customerId,
          fullName: parsed.data.fullName,
          paxType: parsed.data.paxType,
          dob: parsed.data.dob ? new Date(`${parsed.data.dob}T00:00:00Z`) : null,
          passportNumber: parsed.data.passportNumber || null,
        },
      });
      const details = (lead.details ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(details.passengerIds) ? details.passengerIds.filter((value): value is string => typeof value === "string") : [];
      await tx.lead.update({
        where: { id },
        data: { details: { ...details, passengerIds: [...ids, created.id] } as Prisma.InputJsonValue, paxCount: Math.max(lead.paxCount ?? 0, ids.length + 1) },
      });
      for (const booking of lead.bookings.filter((row) => row.status !== "CANCELLED" && row.status !== "REFUNDED")) {
        await tx.bookingPassenger.create({ data: { bookingId: booking.id, passengerId: created.id } });
      }
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "PASSENGER_ADDED",
        byUserId: session.id,
        note: `Passenger ${created.fullName} (${parsed.data.paxType.toLowerCase()}) added (by ${session.name})`,
      });
      return created;
    });
    return jsonSuccess(passenger, 201);
  } catch (error) {
    console.error("[api/leads/passengers]", describeError(error));
    return jsonError(500, "Couldn't add the passenger.");
  }
}
