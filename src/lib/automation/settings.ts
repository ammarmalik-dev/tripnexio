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
    key: "OTB_UPSELL",
    label: "OTB upsell",
    description: "UAE / Oman visa or ticket customers: the day after delivery and 2 days before travel (1 day when close), 4:00 PM, max two per trip.",
    audience: "CUSTOMER",
    events: ["OTB_UPSELL"],
    defaultEnabled: true,
  },
  {
    key: "RETURN_TICKET_UPSELL",
    label: "Return Ticket upsell",
    description: "International visa or flight customers: 3 days and 1 day before travel, 4:00 PM.",
    audience: "CUSTOMER",
    events: ["RETURN_TICKET_UPSELL"],
    defaultEnabled: true,
  },
  {
    key: "VISA_EXTENSION_UPSELL",
    label: "Visa Extension upsell after Visa Change",
    description: "Day 50, 55 and 60 after a Visa Change approval, 12:00 PM.",
    audience: "CUSTOMER",
    events: ["VISA_EXTENSION_UPSELL"],
    defaultEnabled: true,
  },
  {
    key: "NEW_VISA_UPSELL",
    label: "Flight → New Visa upsell",
    description: "International flight customers: 5 days and 2 days before departure, 8:00 PM.",
    audience: "CUSTOMER",
    events: ["NEW_VISA_UPSELL"],
    defaultEnabled: true,
  },
  {
    key: "FLIGHT_UPSELL",
    label: "New Visa → Flight upsell",
    description: "New Visa customers: 5 days and 2 days before departure, 8:00 PM.",
    audience: "CUSTOMER",
    events: ["FLIGHT_UPSELL"],
    defaultEnabled: true,
  },
  {
    key: "COUPON_UNPAID_QUOTATION",
    label: "Unpaid quotation coupon",
    description: "Visa Change / Flight / Visa Extension: a coupon when a selected quotation isn't paid — sent twice, the same day only. Amount and validity in Admin → Coupons.",
    audience: "CUSTOMER",
    events: ["ABANDONED_QUOTE_COUPON"],
    defaultEnabled: true,
  },
  {
    key: "STAFF_ALERTS",
    label: "Staff action-required alerts",
    description: "11:00 AM, 3:00 PM and 6:00 PM: each POC gets one email with only their own new leads, follow-ups, pending sales actions, new bookings, tasks, documents, delays and SLA escalations, with an Excel attachment.",
    audience: "STAFF",
    events: [],
    defaultEnabled: true,
  },
  {
    key: "ADMIN_DAILY_REPORT",
    label: "Admin daily report",
    description: "8:00 PM: one email to Admin with the day's summary and an Excel workbook (a tab per category: sales, operations, leads, bookings, tasks, delays, SLA, P&L, revenue, payments, refunds).",
    audience: "STAFF",
    events: [],
    defaultEnabled: true,
  },
  {
    key: "WEEKLY_REPORT",
    label: "Weekly sales & operations report",
    description: "Monday 12:00 PM: Admin gets the last 7 days with an Excel workbook; each team member gets their own week.",
    audience: "STAFF",
    events: [],
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
