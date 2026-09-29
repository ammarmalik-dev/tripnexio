import type { Prisma, ProtectionPlan } from "../../generated/prisma/client";
import type { ProtectionPlanStatus, RefundStatus } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { createTask } from "../tasks/create-task";
import { PASSPORT_VALIDITY_TASK_TITLE } from "../new-visa/flag-passport-validity";

export const PROTECTION_PLAN_REVIEW_TASK_TITLE = "Protection Plan Review";
export const PROTECTION_PLAN_REFUND_REVIEW_TASK_TITLE = "Protection Plan Refund Review";

/** A plan the customer actually paid for and that isn't already cancelled or in a refund flow. */
export const PURCHASED_PLAN_STATUSES: ProtectionPlanStatus[] = ["PURCHASED", "UNDER_ELIGIBILITY_REVIEW", "ELIGIBLE", "INELIGIBLE"];

export interface PlanActor {
  byUserId?: string;
  /** e.g. "by Sample Admin" or "via razorpay webhook" — appended to audit notes. */
  label: string;
}

type Tx = Prisma.TransactionClient;
type PlanWithBooking = ProtectionPlan & { booking: { id: string; leadId: string } };

/**
 * P12 — OCR signals that put a purchased plan into eligibility review: the
 * passenger's latest passport OCR couldn't verify its MRZ, or the passport
 * expires within 6 months of travel (the P10 staff task, still open). OCR
 * only flags; staff decide Eligible/Ineligible.
 */
export async function ocrFlagReasons(tx: Tx, passengerId: string, leadId: string): Promise<string[]> {
  const reasons: string[] = [];
  const extraction = await tx.documentExtraction.findFirst({
    where: { passengerId, extractionType: "PASSPORT" },
    orderBy: { createdAt: "desc" },
    select: { mrzValid: true },
  });
  if (extraction && !extraction.mrzValid) reasons.push("Passport OCR couldn't verify the MRZ");
  const validityTask = await tx.task.findFirst({
    where: { passengerId, leadId, title: PASSPORT_VALIDITY_TASK_TITLE, status: { in: ["OPEN", "IN_PROGRESS"] } },
    select: { id: true },
  });
  if (validityTask) reasons.push("Passport valid for less than 6 months after travel");
  return reasons;
}

/** Moves a plan to UNDER_ELIGIBILITY_REVIEW and opens the "Protection Plan Review" task. */
export async function openEligibilityReview(tx: Tx, plan: PlanWithBooking, reason: string, actor: PlanActor) {
  await tx.protectionPlan.update({ where: { id: plan.id }, data: { status: "UNDER_ELIGIBILITY_REVIEW" } });
  await writeAudit(tx, {
    entityType: "ProtectionPlan",
    entityId: plan.id,
    action: "STATUS_CHANGE",
    byUserId: actor.byUserId,
    note: `${plan.status} -> UNDER_ELIGIBILITY_REVIEW: ${reason} (${actor.label})`,
  });
  await createTask(tx, {
    type: "PROTECTION_PLAN_REVIEW",
    priority: "HIGH",
    title: PROTECTION_PLAN_REVIEW_TASK_TITLE,
    reason,
    entityType: "ProtectionPlan",
    entityId: plan.id,
    leadId: plan.booking.leadId,
    bookingId: plan.bookingId,
    passengerId: plan.passengerId,
    serviceType: "NEW_VISA",
  });
}

/**
 * Payment success: every plan this payment charged for becomes PURCHASED
 * (keeping the moment the customer accepted the terms), then any OCR flag on
 * that passenger opens an eligibility review. Runs inside the payment-success
 * transaction, so a redelivered webhook can't purchase twice.
 */
export async function purchasePlansForPayment(tx: Tx, paymentId: string, actor: PlanActor): Promise<number> {
  const plans = await tx.protectionPlan.findMany({
    where: { paymentId, status: "TERMS_ACCEPTED" },
    include: { booking: { select: { id: true, leadId: true } } },
  });
  const now = new Date();
  for (const plan of plans) {
    await tx.protectionPlan.update({ where: { id: plan.id }, data: { status: "PURCHASED", termsAcceptedAt: plan.termsAcceptedAt ?? now } });
    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: plan.id,
      action: "STATUS_CHANGE",
      byUserId: actor.byUserId,
      note: `TERMS_ACCEPTED -> PURCHASED, ₹${plan.price} paid with payment ${paymentId} (${actor.label})`,
    });
    const reasons = await ocrFlagReasons(tx, plan.passengerId, plan.booking.leadId);
    if (reasons.length > 0) {
      await openEligibilityReview(tx, { ...plan, status: "PURCHASED" }, reasons.join("; "), { label: "automatic OCR flag" });
    }
  }
  return plans.length;
}

/** A passport OCR run that couldn't verify the MRZ flags this passenger's purchased plans for review. Never throws. */
export async function flagPurchasedPlansFromOcr(passengerId: string, reason: string): Promise<void> {
  try {
    const plans = await db.protectionPlan.findMany({
      where: { passengerId, status: "PURCHASED" },
      include: { booking: { select: { id: true, leadId: true } } },
    });
    for (const plan of plans) {
      await db.$transaction((tx) => openEligibilityReview(tx, plan, reason, { label: "automatic OCR flag" }));
    }
  } catch (error) {
    console.error("[protection-plan/flagPurchasedPlansFromOcr]", error);
  }
}

/** Visa rejected: every purchased plan on the booking goes to refund review with a manager task. */
export async function openRefundReviewsForRejectedVisa(tx: Tx, bookingId: string, reason: string, actor: PlanActor): Promise<number> {
  const plans = await tx.protectionPlan.findMany({
    where: { bookingId, status: { in: PURCHASED_PLAN_STATUSES } },
    include: { booking: { select: { id: true, leadId: true } }, passenger: { select: { fullName: true } } },
  });
  for (const plan of plans) {
    await openRefundReview(tx, plan, `Visa rejected for ${plan.passenger.fullName}: ${reason}`, actor);
  }
  return plans.length;
}

export async function openRefundReview(tx: Tx, plan: PlanWithBooking, reason: string, actor: PlanActor) {
  await tx.protectionPlan.update({ where: { id: plan.id }, data: { status: "REFUND_UNDER_REVIEW" } });
  await writeAudit(tx, {
    entityType: "ProtectionPlan",
    entityId: plan.id,
    action: "STATUS_CHANGE",
    byUserId: actor.byUserId,
    note: `${plan.status} -> REFUND_UNDER_REVIEW: ${reason} (${actor.label})`,
  });
  await createTask(tx, {
    type: "PROTECTION_PLAN_REFUND_REVIEW",
    priority: "HIGH",
    title: PROTECTION_PLAN_REFUND_REVIEW_TASK_TITLE,
    reason: `${reason} — manager/admin to approve or reject a ₹${plan.price} Protection Plan refund.`,
    entityType: "ProtectionPlan",
    entityId: plan.id,
    leadId: plan.booking.leadId,
    bookingId: plan.bookingId,
    passengerId: plan.passengerId,
    serviceType: "NEW_VISA",
  });
}

const PLAN_STATUS_FOR_REFUND: Partial<Record<RefundStatus, ProtectionPlanStatus>> = {
  PROCESSING: "REFUND_PROCESSING",
  COMPLETED: "REFUND_COMPLETED",
  REJECTED: "REFUND_REJECTED",
};

/** Keeps a plan in step with the Refund its approval raised (the refund itself follows the P03 maker-checker rules). */
export async function syncPlanWithRefund(tx: Tx, refundId: string, refundStatus: RefundStatus, actor: PlanActor) {
  const next = PLAN_STATUS_FOR_REFUND[refundStatus];
  if (!next) return;
  const plan = await tx.protectionPlan.findUnique({ where: { refundId } });
  if (!plan || plan.status === next) return;
  await tx.protectionPlan.update({ where: { id: plan.id }, data: { status: next } });
  await writeAudit(tx, {
    entityType: "ProtectionPlan",
    entityId: plan.id,
    action: "STATUS_CHANGE",
    byUserId: actor.byUserId,
    note: `${plan.status} -> ${next} (refund ${refundId} is ${refundStatus}; ${actor.label})`,
  });
}
