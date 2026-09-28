import { escapeHtml } from "../html/escape";

/**
 * `{{placeholder}}` substitution for NotificationTemplate text — replaces every
 * `{{key}}` found in `variables` and leaves anything else untouched
 * (surfacing a typo'd placeholder in the sent message instead of silently
 * blanking it out). Variables are HTML-escaped by default, since most
 * callers render into email HTML and variables include customer-entered
 * values; pass `{ escape: false }` only for plain-text channels (SMS).
 */
/**
 * Lines that must reach the customer whenever their variable is filled in,
 * even if an Admin-edited template body doesn't mention the placeholder.
 */
const REQUIRED_LINES: Record<string, string> = {
  rejectionReason: "Reason: {{rejectionReason}}",
  unsubscribeLink: "To stop these reminders, visit {{unsubscribeLink}}",
};

/** Appends REQUIRED_LINES for filled-in variables the template body doesn't already use. */
export function withRequiredLines(body: string, variables: Record<string, string>): string {
  const extra = Object.entries(REQUIRED_LINES)
    .filter(([key]) => variables[key] && !new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(body))
    .map(([, line]) => line);
  return extra.length > 0 ? `${body}\n\n${extra.join("\n")}` : body;
}

export function renderTemplate(text: string, variables: Record<string, string>, options: { escape?: boolean } = {}): string {
  const escape = options.escape ?? true;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (!(key in variables)) return match;
    return escape ? escapeHtml(variables[key]) : variables[key];
  });
}
