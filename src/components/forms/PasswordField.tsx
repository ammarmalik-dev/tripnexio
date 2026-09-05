"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { cn } from "@/lib/cn";

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ name, label, error, hint, required, className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
        <div className="relative">
          <input
            ref={ref}
            id={name}
            name={name}
            type={visible ? "text" : "password"}
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className={cn(fieldControlClass, fieldBorderClass(!!error), "pr-11", className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-ink-tertiary transition-colors duration-200 hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </FormField>
    );
  }
);

PasswordField.displayName = "PasswordField";
