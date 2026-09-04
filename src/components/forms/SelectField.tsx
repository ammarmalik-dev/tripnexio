import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import type { SelectOption } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  name: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ name, label, options, placeholder = "Select an option", error, hint, required, className, ...props }, ref) => {
    return (
      <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
        <div className="relative">
          <select
            ref={ref}
            id={name}
            name={name}
            defaultValue=""
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className={cn(fieldControlClass, fieldBorderClass(!!error), "appearance-none pr-9", className)}
            {...props}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
            aria-hidden="true"
          />
        </div>
      </FormField>
    );
  }
);

SelectField.displayName = "SelectField";
