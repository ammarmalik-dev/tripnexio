/**
 * The `{{placeholder}}` substitution the NotificationTemplate model's doc
 * comment promised "Phase 5 will wire up" — replaces every `{{key}}` found
 * in `variables` and leaves anything else untouched (surfacing a typo'd
 * placeholder in the sent email instead of silently blanking it out).
 */
export function renderTemplate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in variables ? variables[key] : match));
}
