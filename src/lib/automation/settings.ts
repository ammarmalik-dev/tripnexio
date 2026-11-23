import { db } from "../db";
import { getSystemConfig } from "../settings/system-config";

/**
 * Client doc 16 Nov (N1) — every automation can be switched on / off by Admin (Admin → Automation), and its
 * customer messages have their own Email and WhatsApp templates, each with its own on / off (the template's
 * `active`). Staff automations email staff and have no customer template.
 */
export interface AutomationDefinition {
  key: string;
  label: string;
  description: string;
  audience: "CUSTOMER" | "STAFF";
  /** The NotificationTemplate events this automation sends (customer automations). */
  events: string[];
  /** Off until Admin turns it on (new customer campaigns). */
  defaultEnabled: boolean;
}

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    key: "PAYMENT_REMINDER",
    label: "Payment reminders",
    description: "Visa Change / Visa Extension: every 2 hours until 6:00 PM the same day. New Visa / OTB / Return Ticket: once a day. Flight quotation: 10 and 20 minutes after it is sent (it expires at 30).",
    audience: "CUSTOMER",
    events: ["PAYMENT_REMINDER", "QUOTE_REMINDER"],
    defaultEnabled: true,
  },
  {
    key: "DOCUMENT_REMINDER",
    label: "Document reminders",
    description: "Every day at 12:00 PM and 5:00 PM while required or additional documents are pending.",
    audience: "CUSTOMER",
    events: ["DOCUMENT_REMINDER"],
    defaultEnabled: true,
  },
  {
    key: "VISA_EXTENSION_EXPIRY_REMINDER",
    label: "UAE visa extension reminders",
    description: "UAE visas: 30-day visa on day 20 / 25 / 30, 60-day visa on day 50 / 55 / 60 from travel; after an extension on day 25 / 29. 12:00 PM.",
    audience: "CUSTOMER",
    events: ["VISA_EXTENSION_REMINDER"],
    defaultEnabled: true,
  },
  {
    key: "COUPON_UNPAID_QUOTATION",
    label: "Unpaid quotation coupon",
    description: "Visa Change / Flight / Visa Extension: a coupon when a selected quotation isn't paid — twice, the same day only.",
    audience: "CUSTOMER",
    events: ["ABANDONED_QUOTE_COUPON"],
    defaultEnabled: true,
  },
  {
    key: "SLA_ESCALATION",
    label: "SLA escalation",
    description: "Emails the POC and Admin when a booking breaches its service SLA, repeats at the rule's interval and escalates further. Off = no escalation at all.",
    audience: "STAFF",
    events: [],
    defaultEnabled: true,
  },
];

export function automationDefinition(key: string): AutomationDefinition | undefined {
  return AUTOMATIONS.find((automation) => automation.key === key);
}

/** Is this automation switched on (Admin → Automation)? Unknown keys and a failed read fall back to the default. */
export async function isAutomationEnabled(key: string): Promise<boolean> {
  const fallback = automationDefinition(key)?.defaultEnabled ?? true;
  try {
    const row = await db.automationSetting.findUnique({ where: { key }, select: { enabled: true } });
    return row ? row.enabled : fallback;
  } catch {
    return fallback;
  }
}

/** The local date ("YYYY-MM-DD"), hour and minute in the SystemConfig timezone (IST by default). */
export async function localClock(now: Date = new Date()): Promise<{ date: string; hour: number; minute: number; offsetMs: number }> {
  const { timezoneOffsetMinutes } = await getSystemConfig();
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours(), minute: local.getUTCMinutes(), offsetMs };
}

/** The local date of an instant, with a known offset. */
export function localDateOf(instant: Date, offsetMs: number): string {
  return new Date(instant.getTime() + offsetMs).toISOString().slice(0, 10);
}
