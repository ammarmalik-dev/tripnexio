import { db } from "../db";

/**
 * Dedupe/cooldown check for periodic reminder-style jobs — an n8n schedule
 * calls the same endpoint every few minutes/hours/days, so each job must
 * decide for itself "have I already nudged about this specific thing
 * recently" before sending again. Generic across every job (quote expiry,
 * payment follow-up, OTB document checks, lead follow-up) rather than a
 * bespoke `reminderSentAt` column per model.
 */
export async function wasRecentlyReminded(event: string, entityType: string, entityId: string, cooldownMs: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownMs);
  const recent = await db.automationReminderLog.findFirst({
    where: { event, entityType, entityId, sentAt: { gte: cutoff } },
  });
  return recent !== null;
}

export async function logReminder(event: string, entityType: string, entityId: string): Promise<void> {
  await db.automationReminderLog.create({ data: { event, entityType, entityId } });
}
