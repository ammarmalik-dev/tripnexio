import { NOTIFICATION_EVENTS } from "./events";

/**
 * Client 2026-10-28 ("remove old template and add new template") — the legacy NotificationTemplate events that no
 * code path sends any more, now that every service runs on the client's per-status templates
 * (src/lib/service-status/template-catalog.json). Their rows are set `active = false` by migration
 * 20261028090000_retire_legacy_templates (never deleted) and Admin → Notification Templates hides them unless
 * "Show retired templates" is ticked.
 *
 * - DOCUMENT_REJECTED: no trigger anywhere — a rejection is announced by the review round's DOCUMENTS_REQUIRED
 *   message (lead stage) or the service's "Documents Required" status template (booking stage).
 * - OTB_APPROVED: the "OTB Approved" status sends OTB_10_OTB_APPROVED; the legacy fallback was removed.
 * - SERVICE_STATUS_UPDATE: only ever sent as a ServiceStatus.notificationEvent, and no status uses it any more.
 * - SAMPLE_LEAD_CREATED / SAMPLE_PAYMENT_SUCCESS: seed placeholders, never sent.
 *
 * Every other legacy event is still sent on some path (system messages, reminders, extra payments, lead-stage
 * documents, "Other" service leads…) and stays active — see tests/retired-notification-events.test.ts.
 */
export const RETIRED_NOTIFICATION_EVENTS = [
  NOTIFICATION_EVENTS.DOCUMENT_REJECTED,
  NOTIFICATION_EVENTS.OTB_APPROVED,
  NOTIFICATION_EVENTS.SERVICE_STATUS_UPDATE,
  "SAMPLE_LEAD_CREATED",
  "SAMPLE_PAYMENT_SUCCESS",
] as const;

const RETIRED = new Set<string>(RETIRED_NOTIFICATION_EVENTS);

export function isRetiredNotificationEvent(event: string): boolean {
  return RETIRED.has(event);
}

export type TemplateGroup = "NEW_VISA" | "VISA_CHANGE" | "VISA_EXTENSION" | "OTB" | "RETURN_TICKET" | "FLIGHT_SPECIAL_FARE" | "GENERAL";

export const TEMPLATE_GROUP_OPTIONS: { value: TemplateGroup; label: string }[] = [
  { value: "NEW_VISA", label: "New Visa" },
  { value: "VISA_EXTENSION", label: "Visa Extension" },
  { value: "VISA_CHANGE", label: "Visa Change" },
  { value: "FLIGHT_SPECIAL_FARE", label: "Flight Special Fare" },
  { value: "RETURN_TICKET", label: "Return Verified Ticket" },
  { value: "OTB", label: "OTB" },
  { value: "GENERAL", label: "General / system" },
];

/** Event-code prefixes of the client's status templates (EXT_ is Visa Extension's). */
const PREFIX_GROUPS: [RegExp, TemplateGroup][] = [
  [/^NV_/, "NEW_VISA"],
  [/^(VE|EXT)_/, "VISA_EXTENSION"],
  [/^VC_/, "VISA_CHANGE"],
  [/^(SF|FSF)_/, "FLIGHT_SPECIAL_FARE"],
  [/^(RVT|RT)_/, "RETURN_TICKET"],
  [/^OTB_/, "OTB"],
];

const LEGACY_EVENTS = new Set<string>(Object.values(NOTIFICATION_EVENTS));

/** Which service a template belongs to, from its event code; the shared legacy events (src/lib/notifications/events.ts) are "General". */
export function templateGroupFor(event: string): TemplateGroup {
  // A legacy catalog event is shared by every service, even when its name starts like a prefix (OTB_APPROVED).
  if (LEGACY_EVENTS.has(event)) return "GENERAL";
  return PREFIX_GROUPS.find(([pattern]) => pattern.test(event))?.[1] ?? "GENERAL";
}
