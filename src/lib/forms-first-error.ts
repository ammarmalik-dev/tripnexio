/**
 * The first validation message in a react-hook-form `errors` tree (nested objects / arrays), so a form whose
 * problem sits in a collapsed or derived field (e.g. a Special Fare quote's totals) still tells staff why
 * nothing happened — client doc 2026-10-27 (A6, "unable to draft and send quotation").
 */
export function firstFormErrorMessage(errors: unknown, depth = 0): string | null {
  if (!errors || typeof errors !== "object" || depth > 6) return null;
  const record = errors as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) return record.message;
  for (const [key, value] of Object.entries(record)) {
    if (key === "ref" || key === "type" || key === "types") continue;
    const found = firstFormErrorMessage(value, depth + 1);
    if (found) return found;
  }
  return null;
}
