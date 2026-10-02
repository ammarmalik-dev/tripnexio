import { db } from "../db";
import { ADMIN_FULL_PERMISSION, hasPermission } from "../auth/permissions";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P22 — CRM.md §4/§26 staff notifications feed. One StaffNotification row
 * per recipient (read state is per user).
 *
 * Contract: call AFTER the triggering transaction commits, never inside one
 * (uses the global `db`, which would deadlock inside `db.$transaction` —
 * see the "No global db inside a transaction" note). Never throws — a
 * notification failure must never fail or roll back the business action
 * that triggered it.
 */
export type StaffNotificationType =
  | "NEW_LEAD"
  | "NEW_BOOKING"
  | "QUOTATION_ACCEPTED"
  | "PAYMENT_RECEIVED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_REJECTED"
  | "REFUND_RAISED"
  | "FOLLOW_UP_DUE"
  | "DELAY"
  | "NEW_ENQUIRY"
  | "COMPLAINT";

export interface NotifyStaffInput {
  type: StaffNotificationType;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  recipients: {
    /** Explicit recipients — only active users are kept. */
    userIds?: string[];
    /** Every active user whose role grants this permission (admin.full included). */
    permission?: string;
    /** With `permission`: only users whose service scope includes this service (empty scope = all). */
    serviceType?: ServiceType | null;
  };
}

export async function notifyStaff(input: NotifyStaffInput): Promise<void> {
  try {
    const recipientIds = await resolveRecipients(input.recipients);
    if (recipientIds.length === 0) return;

    await db.staffNotification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title.slice(0, 300),
        body: input.body ?? null,
        link: input.link ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })),
    });
  } catch (error) {
    console.error("[notifyStaff] failed to create staff notifications", { type: input.type, error });
  }
}

async function resolveRecipients(recipients: NotifyStaffInput["recipients"]): Promise<string[]> {
  const ids = new Set<string>();

  const explicit = (recipients.userIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
  if (explicit.length > 0) {
    const activeUsers = await db.user.findMany({
      where: { id: { in: [...new Set(explicit)] }, active: true },
      select: { id: true },
    });
    for (const user of activeUsers) ids.add(user.id);
  }

  if (recipients.permission) {
    const permission = recipients.permission;
    const candidates = await db.user.findMany({
      where: { active: true },
      select: {
        id: true,
        allowedServiceTypes: true,
        role: { select: { permissions: { select: { name: true } } } },
      },
    });
    for (const user of candidates) {
      const checkable = {
        permissions: user.role.permissions.map((p) => p.name),
        allowedServiceTypes: user.allowedServiceTypes,
      };
      if (!hasPermission(checkable, permission)) continue;
      // Same rule as service-scope.ts's hasServiceAccess (inlined so this module has no "@/" alias imports):
      // admin.full or an empty scope = every service.
      const serviceType = recipients.serviceType;
      const unrestricted = checkable.permissions.includes(ADMIN_FULL_PERMISSION) || checkable.allowedServiceTypes.length === 0;
      if (serviceType && !unrestricted && !checkable.allowedServiceTypes.includes(serviceType)) continue;
      ids.add(user.id);
    }
  }

  return [...ids];
}
