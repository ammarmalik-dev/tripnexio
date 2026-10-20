import type { Prisma, ServiceStatus } from "../../generated/prisma/client";
import type { ServiceType, StatusScope, LeadStatus, BookingStatus } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { notifyCustomer } from "../notifications/notify";
import { toWhatsAppId } from "../whatsapp/phone";
import { leadReference } from "../leads/reference";
import { sendStatusTemplate, statusInputsFor, type StatusInputs } from "../notifications/status-template";
import type { EmailAttachment } from "../email/sender";
import { HOLD_MARKER, type ServiceStatusSystemEvent } from "./events";
import { customerStatusLabel } from "./customer-label";

/**
 * Per-service status engine (P08 — CRM.md §14, ADMIN.md §16-17, Locked
 * Business Rules v2.0 §13). A Lead or Booking carries a ServiceStatus from
 * its own service's list; every change goes through here so it is validated
 * against ServiceStatusTransition, audited with the old and new status,
 * mirrored onto the coarse LeadStatus/BookingStatus via mapsTo*, and — when
 * Admin configured one — announced to the customer after commit.
 */

type Tx = Prisma.TransactionClient;

interface EntityState {
  id: string;
  serviceType: ServiceType;
  serviceStatusId: string | null;
  coarseStatus: LeadStatus | BookingStatus;
}

/** A customer message to send once the status change has committed. */
export interface StatusNotification {
  event: string;
  scope: StatusScope;
  entityId: string;
  statusLabel: string;
  /** Client doc 2026-10-20 — what staff typed for the customer (reason, next step, charges…). */
  inputs?: StatusInputs;
}

/** Client doc 2026-10-20 — refund steps a final status (e.g. Rejected, Cancelled) may still move on to. */
const REFUND_STEP_EVENTS = new Set(["REFUND_RAISED", "REFUND_APPROVED", "REFUND_COMPLETED", "CANCELLED_AND_REFUNDED"]);

/**
 * Client doc 2026-10-20 — system events that may move a record BACK within one stage: a rejected
 * document after upload ("Documents Required" again), a fresh quotation after one expired or a new
 * one was requested. Keyed by the event, the value is the systemEvent of the statuses it may leave.
 */
const LOOP_BACK_FROM: Partial<Record<ServiceStatusSystemEvent, Set<string>>> = {
  DOCUMENTS_REJECTED: new Set(["DOCUMENTS_RECEIVED", "DOCUMENTS_REQUESTED", "DOCUMENTS_VALIDATED"]),
  DOCUMENTS_REQUESTED: new Set(["DOCUMENTS_RECEIVED", "DOCUMENTS_REJECTED", "DOCUMENTS_VALIDATED"]),
  QUOTATION_CREATED: new Set(["QUOTE_EXPIRING", "QUOTE_EXPIRED", "NEW_QUOTE_REQUESTED"]),
  QUOTE_EXPIRING: new Set(["QUOTATION_CREATED"]),
};

/** Once past the main document stage, received / validated documents are the "additional" ones (client lists). */
const ADDITIONAL_ALIAS: Partial<Record<ServiceStatusSystemEvent, ServiceStatusSystemEvent>> = {
  DOCUMENTS_RECEIVED: "ADDITIONAL_DOCUMENTS_RECEIVED",
  DOCUMENTS_VALIDATED: "ADDITIONAL_DOCUMENTS_VALIDATED",
};

/** A cancellation step (Cancellation Requested, Partially Cancelled…) — the booking remembers where it came from. */
function isCancellationStep(status: Pick<ServiceStatus, "name" | "systemEvent">): boolean {
  return /cancel/i.test(status.name) && !REFUND_STEP_EVENTS.has(status.systemEvent ?? "");
}

export type SetServiceStatusResult =
  | { ok: true; changed: boolean; notification: StatusNotification | null }
  | { ok: false; httpStatus: 404 | 409; error: string };

async function loadEntity(tx: Tx, scope: StatusScope, entityId: string): Promise<EntityState | null> {
  if (scope === "LEAD") {
    const lead = await tx.lead.findUnique({ where: { id: entityId }, select: { id: true, serviceType: true, serviceStatusId: true, status: true } });
    return lead ? { id: lead.id, serviceType: lead.serviceType, serviceStatusId: lead.serviceStatusId, coarseStatus: lead.status } : null;
  }
  const booking = await tx.booking.findUnique({
    where: { id: entityId },
    select: { id: true, serviceStatusId: true, status: true, lead: { select: { serviceType: true } } },
  });
  return booking ? { id: booking.id, serviceType: booking.lead.serviceType, serviceStatusId: booking.serviceStatusId, coarseStatus: booking.status } : null;
}

/** The first active status of a service's list for that scope (lowest display order, never On Hold) — what a new record starts on. */
export async function getInitialServiceStatusId(tx: Tx, serviceType: ServiceType, scope: StatusScope): Promise<string | null> {
  const status = await tx.serviceStatus.findFirst({
    where: { serviceType, scope, active: true, OR: [{ systemEvent: null }, { systemEvent: { not: HOLD_MARKER } }] },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  return status?.id ?? null;
}

/** The statuses a record may move to next, per the Admin-configured transitions. */
const STAGE_RANK: Record<string, number> = { PENDING: 0, NEW: 0, CONTACTED: 1, QUALIFIED: 1, CONFIRMED: 1, QUOTED: 2, PROCESSING: 2, QUOTATION_ACCEPTED: 3, COMPLETED: 4 };
const END_STAGES = new Set(["CANCELLED", "REFUNDED", "LOST", "CLOSED", "CONVERTED"]);

type StatusShape = Pick<ServiceStatus, "name" | "isTerminal" | "systemEvent" | "mapsToBookingStatus" | "mapsToLeadStatus">;

/**
 * Client doc 2026-10-15 (I1) — the moves staff may never make, even when a transition is configured:
 *   - out of a final status, except on to a refund (e.g. Rejected -> Refund Processing);
 *   - from an approved / extended / delivered status to a rejection or cancellation (e.g. OTB Approved -> Rejected);
 *   - back to an earlier stage (e.g. Processing -> Confirmed). Re-review loops within one stage and On Hold stay allowed.
 * Only an Admin override (I9) can make these moves. Returns the reason, or null when the move is fine.
 */
export function staffMoveBlock(scope: StatusScope, from: StatusShape | null, to: StatusShape): string | null {
  if (!from || from.systemEvent === HOLD_MARKER || to.systemEvent === HOLD_MARKER) return null;
  const coarse = (status: StatusShape) => (scope === "LEAD" ? status.mapsToLeadStatus : status.mapsToBookingStatus) ?? null;
  const toCoarse = coarse(to);
  const fromCoarse = coarse(from);
  if (from.isTerminal && toCoarse !== "REFUNDED" && !REFUND_STEP_EVENTS.has(to.systemEvent ?? "")) return `"${from.name}" is final — only an Admin can move it.`;
  if (/approved|extended|delivered|completed/i.test(from.name) && (toCoarse === "CANCELLED" || /reject/i.test(to.name))) {
    return `"${from.name}" can't be changed to "${to.name}" — only an Admin can do that.`;
  }
  if (fromCoarse && toCoarse && !END_STAGES.has(toCoarse) && !END_STAGES.has(fromCoarse) && (STAGE_RANK[toCoarse] ?? 0) < (STAGE_RANK[fromCoarse] ?? 0)) {
    return `A record can't go back from "${from.name}" to "${to.name}" — only an Admin can do that.`;
  }
  return null;
}

export async function getAllowedNextServiceStatuses(scope: StatusScope, entityId: string) {
  const entity = await loadEntity(db, scope, entityId);
  if (!entity) return null;
  const current = entity.serviceStatusId
    ? await db.serviceStatus.findUnique({
        where: { id: entity.serviceStatusId },
        select: { id: true, name: true, customerLabel: true, isTerminal: true, systemEvent: true, mapsToBookingStatus: true, mapsToLeadStatus: true },
      })
    : null;
  const allowed = current
    ? (
        await db.serviceStatusTransition.findMany({
          where: { fromStatusId: current.id, to: { active: true } },
          select: {
            to: {
              select: { id: true, name: true, customerLabel: true, displayOrder: true, isTerminal: true, systemEvent: true, mapsToBookingStatus: true, mapsToLeadStatus: true, notificationEvent: true },
            },
          },
        })
      )
        .map((transition) => transition.to)
        // Client doc 2026-10-15 (I1) — only the moves staff may actually make.
        .filter((to) => staffMoveBlock(scope, current, to) === null)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : // A record that predates the engine (no status yet) may be placed on any status of its list.
      await db.serviceStatus.findMany({
        where: { serviceType: entity.serviceType, scope, active: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, customerLabel: true, displayOrder: true, notificationEvent: true },
      });
  // Client testing 2026-10-09 (E9) — the service's whole status list (internal name
  // + what the customer sees), so staff can see where a record is and what comes next.
  const all = await db.serviceStatus.findMany({
    where: { serviceType: entity.serviceType, scope, active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, customerLabel: true, isTerminal: true },
  });
  // Client doc 2026-10-20 — per next status: does the customer get a message, and what must staff enter for it.
  const inputs = await statusInputsFor(allowed.map((status) => status.notificationEvent ?? ""));
  return {
    current: current ? { id: current.id, name: current.name, customerLabel: current.customerLabel, isTerminal: current.isTerminal } : null,
    allowed: allowed.map(({ id, name, customerLabel, notificationEvent }) => ({
      id,
      name,
      customerLabel,
      notifies: !!notificationEvent,
      inputs: notificationEvent ? (inputs[notificationEvent] ?? []) : [],
    })),
    all,
  };
}

async function applyStatus(
  tx: Tx,
  scope: StatusScope,
  entity: EntityState,
  from: ServiceStatus | null,
  to: ServiceStatus,
  actor: { userId?: string; actorLabel: string; note?: string; inputs?: StatusInputs; silent?: boolean }
): Promise<StatusNotification | null> {
  const coarseTarget = scope === "LEAD" ? to.mapsToLeadStatus : to.mapsToBookingStatus;
  const coarseChanged = coarseTarget !== null && coarseTarget !== entity.coarseStatus;

  // Client doc 2026-10-20 (N2) — entering a cancellation step remembers the operational status, so a
  // partial cancellation (or a rejected one) can put the booking back on it.
  if (scope === "BOOKING" && isCancellationStep(to) && (!from || (!isCancellationStep(from) && !REFUND_STEP_EVENTS.has(from.systemEvent ?? "")))) {
    await tx.booking.update({ where: { id: entity.id }, data: { resumeServiceStatusId: from?.id ?? null } });
  }

  if (scope === "LEAD") {
    await tx.lead.update({
      where: { id: entity.id },
      data: { serviceStatusId: to.id, ...(coarseChanged ? { status: coarseTarget as LeadStatus } : {}) },
    });
  } else {
    await tx.booking.update({
      where: { id: entity.id },
      data: { serviceStatusId: to.id, ...(coarseChanged ? { status: coarseTarget as BookingStatus } : {}) },
    });
  }

  await writeAudit(tx, {
    entityType: scope === "LEAD" ? "Lead" : "Booking",
    entityId: entity.id,
    action: "SERVICE_STATUS_CHANGE",
    byUserId: actor.userId,
    note:
      `${from?.name ?? "(none)"} -> ${to.name}` +
      (coarseChanged ? ` [${entity.coarseStatus} -> ${coarseTarget}]` : "") +
      (actor.note ? `: ${actor.note}` : "") +
      ` (${actor.actorLabel})`,
  });

  if (!to.notificationEvent || actor.silent) return null;
  const coarseAfter = (coarseChanged ? coarseTarget : entity.coarseStatus) as LeadStatus | BookingStatus;
  return { event: to.notificationEvent, scope, entityId: entity.id, statusLabel: customerStatusLabel(scope, to, coarseAfter), inputs: actor.inputs };
}

/**
 * A staff-chosen status change: the target must belong to the record's own
 * service and scope, and — once the record has a status — be an allowed
 * transition from it.
 */
export async function setServiceStatus(
  tx: Tx,
  input: {
    scope: StatusScope;
    entityId: string;
    toStatusId: string;
    note?: string;
    userId?: string;
    actorLabel: string;
    /** Client doc 2026-10-15 (I9) — an Admin moves the record to any status of its service (reason required, audited). */
    adminOverride?: boolean;
    /** Client doc 2026-10-20 — the customer-safe reason / next step / charges for the status's message. */
    inputs?: StatusInputs;
  }
): Promise<SetServiceStatusResult> {
  const entity = await loadEntity(tx, input.scope, input.entityId);
  if (!entity) return { ok: false, httpStatus: 404, error: "Record not found." };

  const to = await tx.serviceStatus.findUnique({ where: { id: input.toStatusId } });
  if (!to || !to.active || to.serviceType !== entity.serviceType || to.scope !== input.scope) {
    return { ok: false, httpStatus: 409, error: "That status isn't available for this service." };
  }
  if (entity.serviceStatusId === to.id) return { ok: true, changed: false, notification: null };

  const from = entity.serviceStatusId ? await tx.serviceStatus.findUnique({ where: { id: entity.serviceStatusId } }) : null;
  if (input.adminOverride) {
    await writeAudit(tx, {
      entityType: input.scope === "LEAD" ? "Lead" : "Booking",
      entityId: entity.id,
      action: "SERVICE_STATUS_OVERRIDE",
      byUserId: input.userId,
      note: `Admin override: ${from?.name ?? "(none)"} -> ${to.name}${input.note ? `: ${input.note}` : ""} (${input.actorLabel})`,
    });
  } else if (from) {
    const allowed = await tx.serviceStatusTransition.findUnique({
      where: { fromStatusId_toStatusId: { fromStatusId: from.id, toStatusId: to.id } },
    });
    if (!allowed) return { ok: false, httpStatus: 409, error: `Can't move from "${from.name}" to "${to.name}".` };
    const blocked = staffMoveBlock(input.scope, from, to);
    if (blocked) return { ok: false, httpStatus: 409, error: blocked };
  }

  const notification = await applyStatus(tx, input.scope, entity, from, to, input);
  return { ok: true, changed: true, notification };
}

/**
 * A system event (quotation created/accepted, payment success, documents
 * requested/received/validated) moves the record to the status of its
 * service marked with that event — forward only: never backwards, never
 * out of a terminal status or On Hold (staff resume a held record
 * themselves). A service with no status for the event is left unchanged.
 */
export async function applySystemEvent(
  tx: Tx,
  input: { scope: StatusScope; entityId: string; event: ServiceStatusSystemEvent; userId?: string; actorLabel: string; inputs?: StatusInputs; silent?: boolean }
): Promise<StatusNotification | null> {
  const entity = await loadEntity(tx, input.scope, input.entityId);
  if (!entity) return null;

  const findTarget = (event: ServiceStatusSystemEvent) =>
    tx.serviceStatus.findFirst({
      where: { serviceType: entity.serviceType, scope: input.scope, systemEvent: event, active: true },
      orderBy: [{ displayOrder: "asc" }],
    });
  const from = entity.serviceStatusId ? await tx.serviceStatus.findUnique({ where: { id: entity.serviceStatusId } }) : null;
  let to = await findTarget(input.event);
  // Client doc 2026-10-20 — past the main document stage, documents received / validated are the additional ones.
  const alias = ADDITIONAL_ALIAS[input.event];
  if (alias && from && (!to || from.displayOrder >= to.displayOrder)) {
    const additional = await findTarget(alias);
    if (additional) to = additional;
  }
  if (!to || entity.serviceStatusId === to.id) return null;

  if (from && from.systemEvent === HOLD_MARKER) return null;
  if (from && from.isTerminal && !REFUND_STEP_EVENTS.has(input.event)) return null;
  const loopsBack = !!from?.systemEvent && !!LOOP_BACK_FROM[input.event]?.has(from.systemEvent);
  if (from && from.displayOrder >= to.displayOrder && !loopsBack) return null;

  return applyStatus(tx, input.scope, entity, from, to, { ...input, note: `system event ${input.event}` });
}

/**
 * Client doc 2026-10-20 (N2) — puts a booking back on the operational status it had before a
 * cancellation step (a partial cancellation whose refund completed, or a rejected cancellation),
 * without a customer message. No-op when there is nothing to resume.
 */
export async function resumeAfterCancellation(tx: Tx, bookingId: string, actorLabel: string, userId?: string): Promise<void> {
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { resumeServiceStatusId: true } });
  if (!booking?.resumeServiceStatusId) return;
  const entity = await loadEntity(tx, "BOOKING", bookingId);
  const to = await tx.serviceStatus.findUnique({ where: { id: booking.resumeServiceStatusId } });
  if (!entity || !to || !to.active || entity.serviceStatusId === to.id) return;
  const from = entity.serviceStatusId ? await tx.serviceStatus.findUnique({ where: { id: entity.serviceStatusId } }) : null;
  await applyStatus(tx, "BOOKING", entity, from, to, { userId, actorLabel, note: "back to where it was before the cancellation step", silent: true });
  await tx.booking.update({ where: { id: bookingId }, data: { resumeServiceStatusId: null } });
}

/**
 * Sends the customer messages collected from status changes — call after the transaction commits. Never throws.
 * A status with one of the client's templates (client doc 2026-10-20) sends it with the booking's own details;
 * `attachments` go on its email (e.g. the invoice with Paid). Returns how many were sent.
 */
export async function dispatchStatusNotifications(
  notifications: (StatusNotification | null | undefined)[],
  options: { attachments?: EmailAttachment[] } = {}
): Promise<number> {
  let sent = 0;
  for (const notification of notifications) {
    if (!notification) continue;
    if (notification.event !== "SERVICE_STATUS_UPDATE") {
      await sendStatusTemplate({
        event: notification.event,
        scope: notification.scope,
        entityId: notification.entityId,
        statusLabel: notification.statusLabel,
        inputs: notification.inputs,
        attachments: options.attachments,
      });
      sent += 1;
      continue;
    }
    try {
      const lead =
        notification.scope === "LEAD"
          ? await db.lead.findUnique({ where: { id: notification.entityId }, include: { customer: true } })
          : (await db.booking.findUnique({ where: { id: notification.entityId }, include: { lead: { include: { customer: true } } } }))?.lead;
      if (!lead) continue;
      await notifyCustomer({
        event: notification.event,
        emailTo: lead.customer.email,
        whatsappTo: toWhatsAppId(lead.customer.mobile),
        smsTo: toWhatsAppId(lead.customer.mobile),
        variables: { customerName: lead.customer.name, leadReference: leadReference(lead), status: notification.statusLabel },
        auditTarget: { entityType: notification.scope === "LEAD" ? "Lead" : "Booking", entityId: notification.entityId },
      });
      sent += 1;
    } catch (error) {
      console.error("[service-status] status notification failed", error);
    }
  }
  return sent;
}

/**
 * P11 — a staff action named by its system event (e.g. "Applied to
 * Embassy"): resolves the service's status tagged with that event and
 * applies it like a Change Status, so the configured transitions still
 * decide whether it's allowed from where the record is now.
 */
export async function setServiceStatusByEvent(
  tx: Tx,
  input: { scope: StatusScope; entityId: string; event: ServiceStatusSystemEvent; note?: string; userId?: string; actorLabel: string; inputs?: StatusInputs }
): Promise<SetServiceStatusResult> {
  const entity = await loadEntity(tx, input.scope, input.entityId);
  if (!entity) return { ok: false, httpStatus: 404, error: "Record not found." };
  const target = await tx.serviceStatus.findFirst({
    where: { serviceType: entity.serviceType, scope: input.scope, systemEvent: input.event, active: true },
    select: { id: true },
  });
  if (!target) return { ok: false, httpStatus: 409, error: "This action isn't set up for this service (Admin → Service Statuses)." };
  return setServiceStatus(tx, { ...input, toStatusId: target.id });
}

/** P11 — has the booking reached (or passed) the status tagged with `event`, by status order? False when it has no status or the event isn't configured. */
export async function hasReachedStatusEvent(bookingId: string, event: ServiceStatusSystemEvent): Promise<boolean> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { serviceStatus: { select: { displayOrder: true, systemEvent: true } }, lead: { select: { serviceType: true } } },
  });
  if (!booking?.serviceStatus || booking.serviceStatus.systemEvent === HOLD_MARKER) return false;
  const target = await db.serviceStatus.findFirst({
    where: { serviceType: booking.lead.serviceType, scope: "BOOKING", systemEvent: event, active: true },
    select: { displayOrder: true },
  });
  return !!target && booking.serviceStatus.displayOrder >= target.displayOrder;
}

/**
 * Client doc 2026-10-20 (A18) — puts a booking on its service's On Hold status from automation (e.g. the
 * travel date passed a day ago and the service isn't finished), without a customer message: staff get a
 * task and resume it. No-op when it's already on hold, final, or the service has no hold status.
 */
export async function holdBookingSilently(tx: Tx, bookingId: string, actorLabel: string, note: string): Promise<boolean> {
  const entity = await loadEntity(tx, "BOOKING", bookingId);
  if (!entity) return false;
  const from = entity.serviceStatusId ? await tx.serviceStatus.findUnique({ where: { id: entity.serviceStatusId } }) : null;
  if (from && (from.isTerminal || from.systemEvent === HOLD_MARKER)) return false;
  const hold = await tx.serviceStatus.findFirst({ where: { serviceType: entity.serviceType, scope: "BOOKING", systemEvent: HOLD_MARKER, active: true } });
  if (!hold) return false;
  await applyStatus(tx, "BOOKING", entity, from, hold, { actorLabel, note, silent: true });
  return true;
}
