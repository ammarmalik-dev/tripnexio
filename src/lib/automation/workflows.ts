/**
 * Canonical list of background workflows n8n runs against this app — the
 * single source of truth for `workflowKey` values, used by the Admin
 * monitoring screen (to show every expected workflow, even ones that have
 * never run yet) and documented in AUTOMATION_WORKFLOWS.md, which must stay
 * in sync with this list and with the actual n8n workflow JSON under
 * n8n/workflows/. `intendedSchedule` is informational only — n8n owns the
 * real schedule; the app has no way to know it live.
 */
export const AUTOMATION_WORKFLOWS: { key: string; label: string; intendedSchedule: string; endpoint: string }[] = [
  {
    key: "quote-expiry",
    label: "Quote Expiry Handling",
    intendedSchedule: "Every 15 minutes",
    endpoint: "/api/automation/quote-expiry",
  },
  {
    key: "payment-followup",
    label: "Payment Follow-up Reminders",
    intendedSchedule: "Every hour",
    endpoint: "/api/automation/payment-followup",
  },
  {
    key: "otb-requirement-check",
    label: "OTB Requirement Checks",
    intendedSchedule: "Daily at 9:00 AM IST",
    endpoint: "/api/automation/otb-requirement-check",
  },
  {
    key: "lead-followup",
    label: "Periodic Service Follow-ups",
    intendedSchedule: "Daily at 10:00 AM IST",
    endpoint: "/api/automation/lead-followup",
  },
  {
    key: "document-retention",
    label: "Document Retention Purge",
    intendedSchedule: "Weekly, Sunday 3:00 AM IST",
    endpoint: "/api/automation/document-retention",
  },
  {
    key: "visa-extension-reminder",
    label: "Visa Extension: Day-25 Re-Extension Reminder",
    intendedSchedule: "Daily at 9:00 AM IST",
    endpoint: "/api/automation/visa-extension-reminder",
  },
];
