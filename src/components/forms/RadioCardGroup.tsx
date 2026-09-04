import type { FieldValues, Path, UseFormRegister } from "react-hook-form";
import { cn } from "@/lib/cn";

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioCardGroupProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  options: RadioCardOption[];
  register: UseFormRegister<T>;
  selectedValue?: string;
  error?: string;
  required?: boolean;
}

/** A card-style radio group — same register(name) pattern as a native radio group, just restyled. */
export function RadioCardGroup<T extends FieldValues>({
  name,
  label,
  options,
  register,
  selectedValue,
  error,
  required,
}: RadioCardGroupProps<T>) {
  const field = register(name);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink-heading">
        {label}
        {required ? (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const checked = selectedValue === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-xl border bg-surface-1 p-4 transition-colors duration-200",
                checked ? "border-accent shadow-[0_0_0_3px_rgb(62_111_219_/_12%)]" : "border-hairline hover:border-glass-border-strong"
              )}
            >
              <input type="radio" value={option.value} className="sr-only" {...field} />
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink-primary">{option.label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    checked ? "border-accent bg-accent" : "border-hairline"
                  )}
                >
                  {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
              </span>
              {option.description ? (
                <span className="mt-1 block text-xs text-ink-tertiary">{option.description}</span>
              ) : null}
            </label>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
