import { db } from "@/lib/db";
import type { ServiceType } from "../../generated/prisma/enums";

export type FieldErrors = Record<string, string[]>;

/**
 * P24 — server-side reference checks for an Assignment Rule: the
 * sub-service (when set) must exist and belong to the rule's service, and
 * the role (when set) must exist. Returns field errors, or null when valid.
 */
export async function checkAssignmentRuleRefs(input: {
  serviceType: ServiceType;
  subServiceId: string | null;
  roleId: string | null;
}): Promise<FieldErrors | null> {
  const errors: FieldErrors = {};
  if (input.subServiceId) {
    const subService = await db.subService.findUnique({ where: { id: input.subServiceId }, select: { serviceType: true } });
    if (!subService) errors.subServiceId = ["This sub-service doesn't exist."];
    else if (subService.serviceType !== input.serviceType) errors.subServiceId = ["This sub-service belongs to a different service."];
  }
  if (input.roleId) {
    const role = await db.role.findUnique({ where: { id: input.roleId }, select: { id: true } });
    if (!role) errors.roleId = ["This role doesn't exist."];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * P24 — an Escalation Rule's status (when set) must be a BOOKING-scope
 * status of the rule's own service (escalations run on bookings), which
 * also means a status can't be picked without a service.
 */
export async function checkEscalationRuleRefs(input: {
  serviceType: ServiceType | null;
  serviceStatusId: string | null;
}): Promise<FieldErrors | null> {
  if (!input.serviceStatusId) return null;
  if (!input.serviceType) return { serviceType: ["Pick a service before choosing a status."] };
  const status = await db.serviceStatus.findUnique({
    where: { id: input.serviceStatusId },
    select: { serviceType: true, scope: true, isTerminal: true },
  });
  if (!status || status.scope !== "BOOKING") return { serviceStatusId: ["This booking status doesn't exist."] };
  if (status.serviceType !== input.serviceType) return { serviceStatusId: ["This status belongs to a different service."] };
  if (status.isTerminal) return { serviceStatusId: ["A final (terminal) status can't be escalated."] };
  return null;
}

/**
 * P24 item 6 — de-duplicates a staff member's `countriesHandled` and checks
 * every id is a real Country. Returns the clean list, or field errors.
 */
export async function normalizeCountriesHandled(ids: string[]): Promise<{ ids: string[] } | { errors: FieldErrors }> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { ids: [] };
  const found = await db.country.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) return { errors: { countriesHandled: ["One or more selected countries don't exist."] } };
  return { ids: unique };
}
