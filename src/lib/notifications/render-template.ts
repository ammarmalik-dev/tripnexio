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
  ticketDetails: "{{ticketDetails}}",
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

/**
 * Client doc 2026-10-20 — "do not send unresolved placeholders": a line whose every placeholder is
 * empty (e.g. "Reason: {{hold_reason}}" with no reason given) is left out instead of sent half-empty.
 */
export function dropEmptyPlaceholderLines(text: string, variables: Record<string, string>): string {
  return text
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]);
      return keys.length === 0 || keys.some((key) => !(key in variables) || variables[key].trim() !== "");
    })
    .join("\n");
}

/** Client doc 2026-10-20 — tidies a rendered message where an optional value was blank ("tourist / ", "for  ₹3,060"). */
export function tidyRenderedText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+\/[ \t]*$/, "").replace(/([^\s])[ \t]{2,}/g, "$1 ").replace(/:[ \t]*\.(\s|$)/g, ": —.$1"))
    .join("\n");
}
