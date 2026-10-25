import type { ApiErrorBody } from "../api/respond";
import { ADMIN_FULL_PERMISSION } from "./permissions";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Admin handover §1 (pre-launch) — service-wise staff access. Admin assigns, per staff member and per
 * service, which actions they may take. Layered on top of (never replacing) the role permissions in
 * permissions.ts and the older `User.allowedServiceTypes` scope (service-scope.ts):
 * - a user with NO `StaffServicePermission` rows keeps the old behaviour (role + allowedServiceTypes);
 * - a user WITH rows: a service without a row is closed to them, and each action needs its flag in that
 *   row AND the matching role permission (checked separately by requirePermission);
 * - `admin.full` always passes.
 */
export const STAFF_SERVICE_ACTIONS = [
  { value: "VIEW", label: "View", description: "See this service's leads, bookings, quotations and payments" },
  { value: "CREATE_LEAD", label: "Create lead", description: "Create a manual lead or convert an enquiry" },
  { value: "CREATE_QUOTATION", label: "Create quotation", description: "Build, revise and send quotations" },
  { value: "EDIT", label: "Edit", description: "Edit lead details and passengers" },
  { value: "VALIDATE_DOCUMENTS", label: "Document validation", description: "Validate or reject documents" },
  { value: "UPDATE_STATUS", label: "Status update", description: "Change the lead / booking status" },
  { value: "BOOKING", label: "Booking", description: "Booking actions, vendor, outputs" },
  { value: "PAYMENT", label: "Payment", description: "Payment links, mark paid, bank transfer" },
  { value: "REFUND_REQUEST", label: "Refund request", description: "Raise a refund request" },
  { value: "EXPORT", label: "Export", description: "Include this service in CSV exports" },
] as const;

export type StaffServiceAction = (typeof STAFF_SERVICE_ACTIONS)[number]["value"];

export const STAFF_SERVICE_ACTION_VALUES = STAFF_SERVICE_ACTIONS.map((action) => action.value) as [StaffServiceAction, ...StaffServiceAction[]];

export function isStaffServiceAction(value: string): value is StaffServiceAction {
  return (STAFF_SERVICE_ACTION_VALUES as readonly string[]).includes(value);
}

export const STAFF_SERVICE_ACTION_LABELS: Record<StaffServiceAction, string> = Object.fromEntries(
  STAFF_SERVICE_ACTIONS.map((action) => [action.value, action.label])
) as Record<StaffServiceAction, string>;

/** One service's grant. `actions` comes straight from the DB, so it is read defensively (unknown values ignored). */
export interface StaffServiceGrant {
  serviceType: ServiceType;
  actions: string[];
}

export interface ServiceActionCheckable {
  permissions: string[];
  /** null / undefined / [] = no rows = service-wise permissions not in use for this user. */
  servicePermissions?: StaffServiceGrant[] | null;
}

/** True when this user's access is governed by per-service rows (admin.full never is). */
export function usesServicePermissions(session: ServiceActionCheckable | null): boolean {
  if (!session) return false;
  if (session.permissions.includes(ADMIN_FULL_PERMISSION)) return false;
  return (session.servicePermissions?.length ?? 0) > 0;
}

/**
 * Pure check for UI and tests. Does NOT check the role permission (requirePermission does that) nor the
 * older allowedServiceTypes scope (service-scope.ts) — only the per-service action flag.
 */
export function canDoServiceAction(session: ServiceActionCheckable | null, serviceType: ServiceType, action: StaffServiceAction): boolean {
  if (!session) return false;
  if (!usesServicePermissions(session)) return true;
  const grant = session.servicePermissions!.find((row) => row.serviceType === serviceType);
  return !!grant && grant.actions.includes(action);
}

/** Services this user may take `action` on; null = no per-service restriction. */
export function servicesWithAction(session: ServiceActionCheckable | null, action: StaffServiceAction): ServiceType[] | null {
  if (!session || !usesServicePermissions(session)) return null;
  return session.servicePermissions!.filter((row) => row.actions.includes(action)).map((row) => row.serviceType);
}

/**
 * Server helper for a mutation route, called after requirePermission + ownership with the record's own
 * serviceType. Returns a 403 response to return immediately, or null when allowed.
 */
export function assertServiceAction(session: ServiceActionCheckable | null, serviceType: ServiceType, action: StaffServiceAction): Response | null {
  if (canDoServiceAction(session, serviceType, action)) return null;
  // Same `{ error: { message } }` shape as jsonError, built with the web Response so this module stays importable
  // from client components (the Admin editor and useCanDoServiceAction) without pulling in next/server.
  const body: ApiErrorBody = { error: { message: `You don't have "${STAFF_SERVICE_ACTION_LABELS[action]}" access for this service.` } };
  return Response.json(body, { status: 403 });
}

/** Normalises a grant list for storage / display: known actions only, de-duplicated, catalog order. */
export function normaliseActions(actions: readonly string[]): StaffServiceAction[] {
  return STAFF_SERVICE_ACTION_VALUES.filter((value) => actions.includes(value));
}

/** "New Visa: View, Edit; OTB: View" — for audit notes. */
export function summariseServicePermissions(grants: StaffServiceGrant[] | null, labelFor: (serviceType: ServiceType) => string): string {
  if (!grants || grants.length === 0) return "role permissions for every service";
  return grants
    .map((grant) => {
      const actions = normaliseActions(grant.actions);
      return `${labelFor(grant.serviceType)}: ${actions.length > 0 ? actions.map((action) => STAFF_SERVICE_ACTION_LABELS[action]).join(", ") : "no access"}`;
    })
    .join("; ");
}

/**
 * For a CSV export route: the same session, but with VIEW kept only on services that also carry EXPORT, so
 * the route's normal service-scope filter (service-scope.ts) exports only the services this user may export.
 * Unchanged for users without per-service rows (and for admin.full).
 */
export function exportScopedSession<T extends ServiceActionCheckable>(session: T): T {
  if (!usesServicePermissions(session)) return session;
  return {
    ...session,
    servicePermissions: session.servicePermissions!.map((grant) => ({
      serviceType: grant.serviceType,
      actions: grant.actions.includes("EXPORT") ? grant.actions : grant.actions.filter((action) => action !== "VIEW"),
    })),
  };
}
