"use client";

import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { useNationalities } from "@/lib/use-nationalities";
import { cn } from "@/lib/cn";

/** Select value for a row whose nationality is older free text not yet linked to the master. */
export const LEGACY_NATIONALITY_VALUE = "__legacy__";

/** Form value for a row: its nationality id, the legacy marker, or "" for all nationalities. */
export function nationalityFormValue(row: { nationalityId: string | null; nationality: string | null }): string {
  if (row.nationalityId) return row.nationalityId;
  return row.nationality ? LEGACY_NATIONALITY_VALUE : "";
}

/** API payload for that form value: an id, null for all, or undefined to leave legacy text untouched. */
export function nationalityPayload(value: string): string | null | undefined {
  if (value === LEGACY_NATIONALITY_VALUE) return undefined;
  return value === "" ? null : value;
}

/**
 * Nationality picker for Admin pricing rules and document requirements,
 * backed by the Nationality master (P06). Keeps a row's current value
 * selectable even if it's hidden in the master or is older free text.
 */
export function NationalitySelect({
  id,
  value,
  onChange,
  currentName,
  disabled,
  error,
  hint = "Optional — leave as “All nationalities” for a rule that applies to everyone.",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** The row's stored nationality name, used to label a hidden or legacy value. */
  currentName?: string | null;
  disabled?: boolean;
  error?: string;
  hint?: string;
}) {
  const { options } = useNationalities();
  const showCurrent = value !== "" && value !== LEGACY_NATIONALITY_VALUE && !options.some((option) => option.id === value);

  return (
    <FormField label="Nationality" htmlFor={id} error={error} hint={hint}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(!!error))}
      >
        <option value="">All nationalities</option>
        {value === LEGACY_NATIONALITY_VALUE && currentName ? (
          <option value={LEGACY_NATIONALITY_VALUE}>{currentName} (not linked to the list)</option>
        ) : null}
        {showCurrent ? <option value={value}>{currentName ?? "Current nationality"}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}
