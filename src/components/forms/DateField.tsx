import { forwardRef, type InputHTMLAttributes } from "react";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { cn } from "@/lib/cn";

export interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ name, label, error, hint, required, className, min, ...props }, ref) => {
    return (
      <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={name}
          name={name}
          type="date"
          min={min ?? todayIso()}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={cn(fieldControlClass, fieldBorderClass(!!error), className)}
          {...props}
        />
      </FormField>
    );
  }
);

DateField.displayName = "DateField";
