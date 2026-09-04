import { forwardRef, type InputHTMLAttributes } from "react";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { cn } from "@/lib/cn";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ name, label, error, hint, required, className, ...props }, ref) => {
    return (
      <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={name}
          name={name}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={cn(fieldControlClass, fieldBorderClass(!!error), className)}
          {...props}
        />
      </FormField>
    );
  }
);

TextField.displayName = "TextField";
