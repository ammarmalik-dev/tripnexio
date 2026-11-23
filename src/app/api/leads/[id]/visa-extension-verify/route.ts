import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import type { Prisma } from "@/generated/prisma/client";
import { aggregatePassengerChecks, computeEligibilityOutcome, passengerChecksFrom, type PassengerExtensionCheck } from "@/lib/visa-extension/rules";
import { leadPassengersFor } from "@/lib/quotations/lead-passengers";
import { OUTPUT_TYPES } from "@/lib/outputs/output-types";
import { computeUrgentDeadline, extensionToday } from "@/lib/visa-extension/urgency";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

const verifyExpirySchema = z
  .object({
    verifiedExpiryDate: z
      .string()
      .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), "Enter a valid date")
      .optional(),
    /** Client doc 16 Nov (E2) — verify one passenger's visa (each passenger on its own). */
    passengerId: z.string().min(1).optional(),
    /** E2 — this passenger's extension is not accepted (skipped from the quotation), with the reason. */
    notAccepted: z.boolean().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.notAccepted) {
      if (!value.passengerId) ctx.addIssue({ code: "custom", path: ["passengerId"], message: "Pick the passenger" });
      if ((value.reason ?? "").length < 3) ctx.addIssue({ code: "custom", path: ["reason"], message: "Give the reason (at least 3 characters)" });
    } else if (!value.verifiedExpiryDate) {
      ctx.addIssue({ code: "custom", path: ["verifiedExpiryDate"], message: "Enter the verified expiry date" });
    }
  });

/**
 * Visa_Extension.md §8/§9: staff manually verifies the actual visa expiry
 * date (the customer never enters or sees an unverified one, §5/§10). The
 * outcome (see computeEligibilityOutcome) gates quoting (P13). An
 * URGENT_TODAY case also stores its 6:00 PM same-working-day payment
 * deadline, computed on the UAE working calendar, plus any UAE/India
 * holiday on the following day as an extra urgent warning.
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.

  const ownershipError = await assertOwnsEntity(auth.session, "lead", id);

  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = verifyExpirySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(session, lead.serviceType, "EDIT");
  if (actionError) return actionError;
  if (lead.serviceType !== "VISA_EXTENSION") {
    return jsonError(409, "This action only applies to Visa Extension leads.");
  }

  const today = await extensionToday();
  const { urgentDeadline: _previousDeadline, ...existingDetails } = (lead.details as Record<string, unknown>) ?? {};
  void _previousDeadline;

  // Client doc 16 Nov (E2 / E7) — one passenger at a time: documents validated (or rejected) first, then the correct
  // expiry — or "Not accepted" with the reason, which leaves the passenger out of the quotation.
  let passengerChecks: Record<string, PassengerExtensionCheck> | null = null;
  let passengerName = "";
  if (parsed.data.passengerId) {
    const passenger = (await leadPassengersFor(lead.details)).find((row) => row.id === parsed.data.passengerId);
    if (!passenger) return jsonError(400, "That passenger isn't on this lead.", { passengerId: ["Pick a passenger on this lead."] });
    passengerName = passenger.fullName;
    if (!parsed.data.notAccepted) {
      const pending = await db.document.count({
        where: { leadId: id, passengerId: passenger.id, status: { in: ["RECEIVED", "REJECTED"] }, purgedAt: null, type: { notIn: [...OUTPUT_TYPES] } },
      });
      if (pending > 0) return jsonError(409, `Validate (or reject) ${passenger.fullName}'s documents first — a rejected document must be re-uploaded and validated before the expiry date is entered.`);
    }
    const checks = passengerChecksFrom(lead.details);
    checks[passenger.id] = parsed.data.notAccepted
      ? { verifiedExpiryDate: null, outcome: "NOT_ELIGIBLE", reason: parsed.data.reason, verifiedAt: new Date().toISOString() }
      : { verifiedExpiryDate: parsed.data.verifiedExpiryDate!, outcome: computeEligibilityOutcome(parsed.data.verifiedExpiryDate!, today), verifiedAt: new Date().toISOString() };
    passengerChecks = checks;
  }
  const overall = passengerChecks ? aggregatePassengerChecks(passengerChecks) : null;
  const verifiedExpiryDate = overall ? overall.verifiedExpiryDate : parsed.data.verifiedExpiryDate!;
  const outcome = overall ? overall.outcome : computeEligibilityOutcome(verifiedExpiryDate!, today);
  const urgentDeadline = outcome === "URGENT_TODAY" && verifiedExpiryDate ? await computeUrgentDeadline(new Date(), verifiedExpiryDate) : null;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id },
      data: {
        details: {
          ...existingDetails,
          verifiedExpiryDate,
          eligibilityOutcome: outcome,
          ...(passengerChecks ? { passengerChecks } : {}),
          verifiedByStaffId: session.id,
          verifiedAt: new Date().toISOString(),
          ...(urgentDeadline ? { urgentDeadline } : {}),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "VISA_EXTENSION_EXPIRY_VERIFIED",
      byUserId: session.id,
      note: `${passengerName ? (parsed.data.notAccepted ? `${passengerName}: not accepted — ${parsed.data.reason}; ` : `${passengerName}: verified expiry ${parsed.data.verifiedExpiryDate}; `) + "overall " : "Verified expiry "}${verifiedExpiryDate ?? "—"} -> ${outcome}${urgentDeadline ? `, pay by 6:00 PM ${urgentDeadline.day}${urgentDeadline.nextDayHolidays.length > 0 ? ` (next day holiday: ${urgentDeadline.nextDayHolidays.map((h) => `${h.country} ${h.name}`).join(", ")})` : ""}` : ""} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess({ leadId: updated.id, verifiedExpiryDate, outcome, urgentDeadline, passengerChecks: passengerChecks ?? passengerChecksFrom(lead.details) });
}
