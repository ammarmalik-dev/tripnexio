"use client";

import { useState, type KeyboardEvent } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { cn } from "@/lib/cn";

export interface SearchableOption {
  value: string;
  label: string;
  /** Optional second line under the label in the suggestion list. */
  detail?: string;
}

const MAX_SUGGESTIONS = 50;

/**
 * Searchable dropdown over a preloaded option list — same look and keyboard
 * behaviour as AirportSearchField, but strict: the form value is only ever
 * a picked option's `value` (an id or code), never free text. Typing clears
 * the stored value until an option is picked again, so the field's own zod
 * rule reports "select one" instead of silently accepting a typo.
 */
export function SearchableSelectField({
  name,
  label,
  options,
  required,
  error,
  hint = "Start typing to search.",
  placeholder,
}: {
  name: string;
  label: string;
  options: SearchableOption[];
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const { register, setValue, watch } = useFormContext();
  const registration = register(name);
  const storedValue = (watch(name) as string | undefined) ?? "";
  const selected = options.find((option) => option.value === storedValue);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${name.replace(/[^a-zA-Z0-9]/g, "-")}-options`;

  // While the customer is typing, show their text; otherwise show the picked option's label.
  const text = query ?? selected?.label ?? "";
  const needle = (query ?? "").trim().toLowerCase();
  const matches = (needle
    ? options.filter(
        (option) => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle)
      )
    : options
  ).slice(0, MAX_SUGGESTIONS);

  const pick = (option: SearchableOption) => {
    setValue(name, option.value, { shouldValidate: true, shouldDirty: true });
    setQuery(null);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (matches.length === 0 ? -1 : (index + 1) % matches.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? matches.length - 1 : index - 1));
    } else if (event.key === "Enter" && open && activeIndex >= 0 && matches[activeIndex]) {
      event.preventDefault();
      pick(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <div className="relative">
        <input type="hidden" {...registration} />
        <input
          id={name}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          placeholder={placeholder}
          value={text}
          className={cn(fieldControlClass, fieldBorderClass(!!error))}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
            if (storedValue) setValue(name, "", { shouldDirty: true });
          }}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false);
              setQuery(null);
            }, 150);
          }}
          onKeyDown={handleKeyDown}
        />
        {open && matches.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-hairline bg-surface-1 py-1 shadow-lg"
          >
            {matches.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "cursor-pointer px-3.5 py-2 text-sm text-ink-primary",
                  index === activeIndex ? "bg-surface-2" : "hover:bg-surface-2"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option);
                }}
              >
                <span className="font-medium">{option.label}</span>
                {option.detail ? <span className="block text-xs text-ink-tertiary">{option.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </FormField>
  );
}
