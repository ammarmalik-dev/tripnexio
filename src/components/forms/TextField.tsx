import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { cn } from "@/lib/cn";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /** Optional icon shown inside the field, on the left. */
  leadingIcon?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ name, label, error, hint, required, className, leadingIcon, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={cn(fieldControlClass, fieldBorderClass(!!error), leadingIcon ? "pl-10" : null, className)}
        {...props}
      />
    );
    return (
      <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
        {leadingIcon ? (
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden="true">
              {leadingIcon}
            </span>
            {input}
          </div>
        ) : (
          input
        )}
      </FormField>
    );
  }
);

TextField.displayName = "TextField";
