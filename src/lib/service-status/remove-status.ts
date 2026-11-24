import type { db } from "../db";
import { writeAudit } from "../audit/log";
import { withReason } from "../validation/sensitive-action";
import templateCatalog from "./template-catalog.json";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Events of the client's status templates (template-catalog.json) — only these are removed with their status. */
const STATUS_TEMPLATE_EVENTS = new Set((templateCatalog as { event: string }[]).map((template) => template.event));

/** What still points at a status: leads / bookings on it (or resuming to it) and SLA rules. Any of these blocks deleting it. */
export async function statusUsage(client: Tx | typeof db, statusId: string) {
  const [leads, bookings, resuming, escalationRules] = [
    await client.lead.count({ where: { serviceStatusId: statusId } }),
    await client.booking.count({ where: { serviceStatusId: statusId } }),
    await client.booking.count({ where: { resumeServiceStatusId: statusId } }),
    await client.escalationRule.count({ where: { serviceStatusId: statusId } }),
  ];
  return { leads, bookings: bookings + resuming, escalationRules, total: leads + bookings + resuming + escalationRules };
}

export function usageMessage(name: string, usage: Awaited<ReturnType<typeof statusUsage>>): string {
  const parts = [
    usage.leads ? `${usage.leads} lead${usage.leads === 1 ? "" : "s"}` : null,
    usage.bookings ? `${usage.bookings} booking${usage.bookings === 1 ? "" : "s"}` : null,
    usage.escalationRules ? `${usage.escalationRules} SLA rule${usage.escalationRules === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return `"${name}" is still used by ${parts.join(", ")} — move them to another status first, or disable it instead.`;
}

/**
 * Client doc 16 Nov (G1) — Admin deletes a status: its transitions, and its customer templates when no other status
 * sends them, go with it. Callers check `statusUsage` first. Past moves stay in the audit trail (they are text).
 */
export async function removeServiceStatus(
  tx: Tx,
  status: { id: string; name: string; serviceType: string; scope: string; notificationEvent: string | null },
  actor: { id: string; name: string },
  reason: string
) {
  const transitions = await tx.serviceStatusTransition.deleteMany({ where: { OR: [{ fromStatusId: status.id }, { toStatusId: status.id }] } });
  let templates = 0;
  const event = status.notificationEvent;
  if (event && STATUS_TEMPLATE_EVENTS.has(event)) {
    const sharedBy = await tx.serviceStatus.count({ where: { notificationEvent: event, id: { not: status.id } } });
    if (sharedBy === 0) templates = (await tx.notificationTemplate.deleteMany({ where: { event } })).count;
  }
  await tx.serviceStatus.delete({ where: { id: status.id } });
  await writeAudit(tx, {
    entityType: "ServiceStatus",
    entityId: status.id,
    action: "DELETE",
    byUserId: actor.id,
    note: withReason(
      `Status "${status.name}" deleted from ${status.serviceType}/${status.scope}, with ${transitions.count} transition(s)${templates ? ` and ${templates} template(s) (${event})` : ""} (by ${actor.name})`,
      reason
    ),
  });
  return { transitions: transitions.count, templates };
}
