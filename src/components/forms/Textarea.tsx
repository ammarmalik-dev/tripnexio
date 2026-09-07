import { forwardRef, type TextareaHTMLAttributes } from "react";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { cn } from "@/lib/cn";

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ name, label, error, hint, required, className, rows = 4, ...props }, ref) => {
    return (
      <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
        <textarea
          ref={ref}
          id={name}
          name={name}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={cn(fieldControlClass, fieldBorderClass(!!error), "h-auto py-2.5", className)}
          {...props}
        />
      </FormField>
    );
  }
);

Textarea.displayName = "Textarea";
