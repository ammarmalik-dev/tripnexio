import { useEffect } from "react";
import { useFormContext, type FieldValues, type Path, type PathValue } from "react-hook-form";

/**
 * Live check 2026-10-21 — a register()ed native <select> whose options load after it mounts (a ?country= link,
 * or coming Back to a step) can't take the form's value at mount, so it showed the first option (UAE) while the
 * form held another (THA). Re-applies the value once the options arrive; `clearUnknown` drops one not offered.
 */
export function useSyncSelectValue<T extends FieldValues>(name: Path<T>, options: { value: string }[], clearUnknown = false) {
  const { getValues, setValue } = useFormContext<T>();
  useEffect(() => {
    if (options.length === 0) return;
    const current = getValues(name) as unknown;
    if (typeof current !== "string" || !current) return;
    const known = options.some((option) => option.value === current);
    if (known || clearUnknown) setValue(name, (known ? current : "") as PathValue<T, Path<T>>);
  }, [options, name, clearUnknown, getValues, setValue]);
}
