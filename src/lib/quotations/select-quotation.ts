import crypto from "crypto";
import { getTimezoneOffsetMinutes } from "../settings/system-config";
import { parseStoredItinerary } from "./itinerary";
import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { isExpiredNow } from "./sync-expiry";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "../service-status/engine";

export interface SelectActor {
  byUserId?: string;
  /** e.g. "by Sample Admin" or "by the customer" — appended to every audit note this writes. */
  label: string;
}

/**
 * Marks one quotation selected and expires every other quotation on the same
 * lead (the spec's "one active quotation" rule), moving the Lead to QUOTED.
 * Shared by the staff CRM route (PATCH /api/quotations/[id]/select) and the
 * customer review page's approve action — same transition either way, only
 * the actor differs.
 */
export async function selectQuotation(quotationId: string, actor: SelectActor) {
  const quotation = await db.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) return { ok: false as const, error: "Quotation not found." };
  // P22 — an unsent draft is invisible to the customer and can never be selected (staff or customer).
  if (quotation.isDraft) {
    return { ok: false as const, error: "This quotation is still a draft — send it to the customer before it can be selected." };
  }
  if (isExpiredNow(quotation)) {
    return { ok: false as const, error: "This quotation has expired and can't be selected." };
  }
  if (quotation.isSelected) return { ok: true as const, quotation };

  const statusNotifications: (StatusNotification | null)[] = [];
  const result = await db.$transaction(async (tx) => {
    const others = await tx.quotation.findMany({
      where: { leadId: quotation.leadId, id: { not: quotationId } },
    });

    for (const other of others) {
      if (other.isSelected || !other.isExpired) {
        await tx.quotation.update({ where: { id: other.id }, data: { isSelected: false, isExpired: true } });
        await writeAudit(tx, {
          entityType: "Quotation",
          entityId: other.id,
          action: "EXPIRE",
          byUserId: actor.byUserId,
          note: `Expired — quotation ${quotationId} was selected instead for lead ${quotation.leadId} (${actor.label})`,
        });
      }
    }

    const selected = await tx.quotation.update({ where: { id: quotationId }, data: { isSelected: true } });
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: quotationId,
      action: "SELECT",
      byUserId: actor.byUserId,
      note: `Selected for lead ${quotation.leadId} (${actor.label})`,
    });

    const lead = await tx.lead.findUnique({ where: { id: quotation.leadId } });
    // Step 49 — QUOTED -> QUOTATION_ACCEPTED. Skip the write if the lead is
    // already at (or past) that point in the funnel — same "don't
    // re-write/regress" intent as the old two-status guard, just naming all
    // three later states explicitly now that QUOTED is split into more steps.
    if (
      lead &&
      lead.status !== "QUOTATION_ACCEPTED" &&
      lead.status !== "PAYMENT_PENDING" &&
      lead.status !== "CONVERTED"
    ) {
      await tx.lead.update({ where: { id: lead.id }, data: { status: "QUOTATION_ACCEPTED" } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "STATUS_CHANGE",
        byUserId: actor.byUserId,
        note: `${lead.status} -> QUOTATION_ACCEPTED (quotation selected ${actor.label})`,
      });
    }
    // Client doc 16 Nov (A15) — accepting a flight option moves the lead's travel date (and a round trip's return
    // date) to that option's flight dates, in the business timezone; audited when it changes.
    if (lead && lead.serviceType === "FLIGHT_SPECIAL_FARE") await syncTravelDatesFromQuote(tx, lead, selected, actor);
    if (lead) {
      statusNotifications.push(
        await applySystemEvent(tx, { scope: "LEAD", entityId: lead.id, event: "QUOTATION_ACCEPTED", userId: actor.byUserId, actorLabel: actor.label })
      );
    }

    return selected;
  });

  await dispatchStatusNotifications(statusNotifications);
  return { ok: true as const, quotation: result };
}

async function syncTravelDatesFromQuote(
  tx: Prisma.TransactionClient,
  lead: { id: string; travelDate: Date | null; details: Prisma.JsonValue },
  quote: { flightDateTime: Date | null; itinerary: Prisma.JsonValue },
  actor: SelectActor
): Promise<void> {
  const offsetMinutes = await getTimezoneOffsetMinutes(tx);
  const dayOf = (value: Date | string | undefined | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
  };
  const sectors = parseStoredItinerary(quote.itinerary);
  const outboundDay = dayOf(quote.flightDateTime ?? sectors.find((sector) => sector.leg !== "RETURN")?.departAt);
  const returnDay = dayOf(sectors.find((sector) => sector.leg === "RETURN")?.departAt);
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const currentDay = lead.travelDate ? lead.travelDate.toISOString().slice(0, 10) : null;
  const travelChanged = outboundDay !== null && outboundDay !== currentDay;
  const returnChanged = returnDay !== null && returnDay !== details.returnDate;
  if (!travelChanged && !returnChanged) return;
  await tx.lead.update({
    where: { id: lead.id },
    data: {
      ...(travelChanged ? { travelDate: new Date(`${outboundDay}T00:00:00.000Z`) } : {}),
      details: { ...details, ...(travelChanged ? { travelDate: outboundDay } : {}), ...(returnChanged ? { returnDate: returnDay } : {}) } as Prisma.InputJsonObject,
    },
  });
  await writeAudit(tx, {
    entityType: "Lead",
    entityId: lead.id,
    action: "TRAVEL_DATE_UPDATED",
    byUserId: actor.byUserId,
    note: [
      travelChanged ? `Travel date ${currentDay ?? "—"} -> ${outboundDay}` : null,
      returnChanged ? `Return date ${typeof details.returnDate === "string" ? details.returnDate : "—"} -> ${returnDay}` : null,
    ]
      .filter(Boolean)
      .join("; ") + ` (from the selected flight option, ${actor.label})`,
  });
}

/** Generates a random token, retrying on the astronomically unlikely unique-constraint collision. */
export function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

type LeadForToken = { id: string; customerToken: string | null };

/** Backfills Lead.customerToken for a lead that doesn't have one yet (e.g. one created before this field existed). */
export async function ensureLeadCustomerToken(lead: LeadForToken, tx: Prisma.TransactionClient = db): Promise<string> {
  if (lead.customerToken) return lead.customerToken;
  const token = generateToken();
  await tx.lead.update({ where: { id: lead.id }, data: { customerToken: token } });
  return token;
}
