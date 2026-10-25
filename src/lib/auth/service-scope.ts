import { jsonError } from "@/lib/api/respond";
import { ADMIN_FULL_PERMISSION } from "./permissions";
import { servicesWithAction, type StaffServiceGrant } from "./service-actions";
import type { ServiceType } from "../../generated/prisma/enums";

export interface ServiceScopeCheckable {
  permissions: string[];
  allowedServiceTypes: ServiceType[];
  /**
   * Admin handover §1 — per-service action rows (service-actions.ts). When present (non-empty), only the
   * services whose row has VIEW are in scope, intersected with allowedServiceTypes when that is set.
   */
  servicePermissions?: StaffServiceGrant[] | null;
}

/**
 * The services this session may see, or null when unrestricted. An empty array means NO service (a user
 * whose per-service rows grant VIEW nowhere) — unlike `allowedServiceTypes`, where empty = unrestricted.
 */
export function effectiveServiceScope(session: ServiceScopeCheckable | null): ServiceType[] | null {
  if (!session) return [];
  if (session.permissions.includes(ADMIN_FULL_PERMISSION)) return null;
  const viewable = servicesWithAction(session, "VIEW");
  const allowed = session.allowedServiceTypes.length > 0 ? session.allowedServiceTypes : null;
  if (viewable === null) return allowed;
  return allowed ? viewable.filter((service) => allowed.includes(service)) : viewable;
}

/**
 * Step 39 (Admin FINAL handover §1) — service-scoped RBAC, layered on top
 * of (not replacing) the existing name-based permission system in
 * permissions.ts. Empty `allowedServiceTypes` (the default on every
 * existing user) or `admin.full` = UNRESTRICTED, mirroring
 * hasPermission()'s own bypass rule so an Admin can never accidentally
 * lock themselves out via scoping.
 */
export function isServiceScopeUnrestricted(session: ServiceScopeCheckable | null): boolean {
  if (!session) return false;
  return effectiveServiceScope(session) === null;
}

/** For a detail/mutation route, once the resource's own serviceType is known. */
export function hasServiceAccess(session: ServiceScopeCheckable | null, serviceType: ServiceType): boolean {
  if (!session) return false;
  const scope = effectiveServiceScope(session);
  return scope === null || scope.includes(serviceType);
}

/**
 * For a detail/mutation route: fetch the resource, resolve its
 * serviceType, then call this. Returns a 403 Response to return
 * immediately, or null if access is fine.
 *
 * Usage: `const scopeError = assertServiceAccess(auth.session, lead.serviceType); if (scopeError) return scopeError;`
 */
export function assertServiceAccess(session: ServiceScopeCheckable | null, serviceType: ServiceType): Response | null {
  if (hasServiceAccess(session, serviceType)) return null;
  return jsonError(403, "You don't have access to this service.");
}

/**
 * For a list route's `where` builder. `requested` is an optional
 * caller-chosen serviceType filter (already validated against the enum by
 * the route's own zod query schema). Returns the Prisma condition to
 * spread into a `where` object (or nest under a relation, e.g.
 * `lead: { ...serviceTypeCondition(session, requested) }`):
 * - `{}` when unrestricted and no filter requested.
 * - `{ serviceType: requested }` when requested is within scope (or
 *   unrestricted).
 * - `{ serviceType: { in: [] } }` when requested is OUTSIDE scope — an
 *   empty, always-false filter, not a 403. A list route should return an
 *   empty result for an out-of-scope filter, never error; only a
 *   detail/mutation route (assertServiceAccess above) 403s.
 * - `{ serviceType: { in: scope } }` when scoped and no specific filter requested.
 */
export function serviceTypeCondition(
  session: ServiceScopeCheckable | null,
  requested?: ServiceType
): { serviceType?: ServiceType | { in: ServiceType[] } } {
  const scope = effectiveServiceScope(session);
  if (scope === null) {
    return requested ? { serviceType: requested } : {};
  }
  if (requested) {
    return scope.includes(requested) ? { serviceType: requested } : { serviceType: { in: [] } };
  }
  return { serviceType: { in: scope } };
}
