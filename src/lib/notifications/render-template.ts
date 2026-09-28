import { escapeHtml } from "../html/escape";

/**
 * `{{placeholder}}` substitution for NotificationTemplate text — replaces every
 * `{{key}}` found in `variables` and leaves anything else untouched
 * (surfacing a typo'd placeholder in the sent message instead of silently
 * blanking it out). Variables are HTML-escaped by default, since most
 * callers render into email HTML and variables include customer-entered
 * values; pass `{ escape: false }` only for plain-text channels (SMS).
 */
export function renderTemplate(text: string, variables: Record<string, string>, options: { escape?: boolean } = {}): string {
  const escape = options.escape ?? true;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (!(key in variables)) return match;
    return escape ? escapeHtml(variables[key]) : variables[key];
  });
}
