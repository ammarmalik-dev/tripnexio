import type { Prisma, ServiceStatus } from "../../generated/prisma/client";
import type { ServiceType, StatusScope, LeadStatus, BookingStatus } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { notifyCustomer } from "../notifications/notify";
import { toWhatsAppId } from "../whatsapp/phone";
import { leadReference } from "../leads/reference";
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
export async function getAllowedNextServiceStatuses(scope: StatusScope, entityId: string) {
  const entity = await loadEntity(db, scope, entityId);
  if (!entity) return null;
  const current = entity.serviceStatusId
    ? await db.serviceStatus.findUnique({ where: { id: entity.serviceStatusId }, select: { id: true, name: true, customerLabel: true, isTerminal: true } })
    : null;
  const allowed = current
    ? (
        await db.serviceStatusTransition.findMany({
          where: { fromStatusId: current.id, to: { active: true } },
          select: { to: { select: { id: true, name: true, displayOrder: true } } },
        })
      )
        .map((transition) => transition.to)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : // A record that predates the engine (no status yet) may be placed on any status of its list.
      await db.serviceStatus.findMany({
        where: { serviceType: entity.serviceType, scope, active: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, displayOrder: true },
      });
  return { current, allowed: allowed.map(({ id, name }) => ({ id, name })) };
}

async function applyStatus(
  tx: Tx,
  scope: StatusScope,
  entity: EntityState,
  from: ServiceStatus | null,
  to: ServiceStatus,
  actor: { userId?: string; actorLabel: string; note?: string }
): Promise<StatusNotification | null> {
  const coarseTarget = scope === "LEAD" ? to.mapsToLeadStatus : to.mapsToBookingStatus;
  const coarseChanged = coarseTarget !== null && coarseTarget !== entity.coarseStatus;

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

  if (!to.notificationEvent) return null;
  const coarseAfter = (coarseChanged ? coarseTarget : entity.coarseStatus) as LeadStatus | BookingStatus;
  return { event: to.notificationEvent, scope, entityId: entity.id, statusLabel: customerStatusLabel(scope, to, coarseAfter) };
}

/**
 * A staff-chosen status change: the target must belong to the record's own
 * service and scope, and — once the record has a status — be an allowed
 * transition from it.
 */
export async function setServiceStatus(
  tx: Tx,
  input: { scope: StatusScope; entityId: string; toStatusId: string; note?: string; userId?: string; actorLabel: string }
): Promise<SetServiceStatusResult> {
  const entity = await loadEntity(tx, input.scope, input.entityId);
  if (!entity) return { ok: false, httpStatus: 404, error: "Record not found." };

  const to = await tx.serviceStatus.findUnique({ where: { id: input.toStatusId } });
  if (!to || !to.active || to.serviceType !== entity.serviceType || to.scope !== input.scope) {
    return { ok: false, httpStatus: 409, error: "That status isn't available for this service." };
  }
  if (entity.serviceStatusId === to.id) return { ok: true, changed: false, notification: null };

  const from = entity.serviceStatusId ? await tx.serviceStatus.findUnique({ where: { id: entity.serviceStatusId } }) : null;
  if (from) {
    const allowed = await tx.serviceStatusTransition.findUnique({
      where: { fromStatusId_toStatusId: { fromStatusId: from.id, toStatusId: to.id } },
    });
    if (!allowed) return { ok: false, httpStatus: 409, error: `Can't move from "${from.name}" to "${to.name}".` };
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
  input: { scope: StatusScope; entityId: string; event: ServiceStatusSystemEvent; userId?: string; actorLabel: string }
): Promise<StatusNotification | null> {
  const entity = await loadEntity(tx, input.scope, input.entityId);
  if (!entity) return null;

  const to = await tx.serviceStatus.findFirst({
    where: { serviceType: entity.serviceType, scope: input.scope, systemEvent: input.event, active: true },
    orderBy: [{ displayOrder: "asc" }],
  });
  if (!to || entity.serviceStatusId === to.id) return null;

  const from = entity.serviceStatusId ? await tx.serviceStatus.findUnique({ where: { id: entity.serviceStatusId } }) : null;
  if (from && (from.isTerminal || from.systemEvent === HOLD_MARKER || from.displayOrder >= to.displayOrder)) return null;

  return applyStatus(tx, input.scope, entity, from, to, { ...input, note: `system event ${input.event}` });
}

/** Sends the customer messages collected from status changes — call after the transaction commits. Never throws. */
export async function dispatchStatusNotifications(notifications: (StatusNotification | null | undefined)[]): Promise<void> {
  for (const notification of notifications) {
    if (!notification) continue;
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
    } catch (error) {
      console.error("[service-status] status notification failed", error);
    }
  }
}

/**
 * P11 — a staff action named by its system event (e.g. "Applied to
 * Embassy"): resolves the service's status tagged with that event and
 * applies it like a Change Status, so the configured transitions still
 * decide whether it's allowed from where the record is now.
 */
export async function setServiceStatusByEvent(
  tx: Tx,
  input: { scope: StatusScope; entityId: string; event: ServiceStatusSystemEvent; note?: string; userId?: string; actorLabel: string }
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
