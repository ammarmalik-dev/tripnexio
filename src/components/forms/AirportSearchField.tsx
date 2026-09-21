"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, fieldControlClass, fieldBorderClass } from "./FormField";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface AirportOption {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
}

const SEARCH_DEBOUNCE_MS = 250;

export function formatAirportValue(airport: AirportOption): string {
  return `${airport.city} - ${airport.name} (${airport.code})`;
}

/**
 * Searchable airport dropdown backed by the Admin-managed airport database
 * (GET /api/airports). Picking a suggestion fills the field with
 * "City - Airport Name (CODE)"; typing something that isn't in the database
 * is still accepted as free text, so the form keeps working while the
 * airport list is being imported/extended.
 */
export function AirportSearchField({
  name,
  label,
  required,
  error,
  hint = "Start typing a city, airport name or code.",
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const { register, setValue } = useFormContext();
  const registration = register(name);
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const listId = `${name.replace(/[^a-zA-Z0-9]/g, "-")}-airport-list`;

  const search = (query: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setOptions([]);
        setOpen(false);
        return;
      }
      const current = ++requestId.current;
      try {
        const result = await getJson<AirportOption[]>(`/api/airports?q=${encodeURIComponent(query.trim())}`);
        if (current !== requestId.current) return;
        setOptions(result);
        setActiveIndex(-1);
        setOpen(result.length > 0);
      } catch {
        if (current === requestId.current) setOptions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const pick = (airport: AirportOption) => {
    setValue(name, formatAirportValue(airport), { shouldValidate: true, shouldDirty: true });
    setOpen(false);
    setOptions([]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      pick(options[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <FormField label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <div className="relative">
        <input
          id={name}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          className={cn(fieldControlClass, fieldBorderClass(!!error))}
          {...registration}
          onChange={(event) => {
            void registration.onChange(event);
            search(event.target.value);
          }}
          onBlur={(event) => {
            void registration.onBlur(event);
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-hairline bg-surface-1 py-1 shadow-lg"
          >
            {options.map((airport, index) => (
              <li
                key={airport.id}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "cursor-pointer px-3.5 py-2 text-sm text-ink-primary",
                  index === activeIndex ? "bg-surface-2" : "hover:bg-surface-2"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(airport);
                }}
              >
                <span className="font-medium">
                  {airport.city} ({airport.code})
                </span>
                <span className="block text-xs text-ink-tertiary">
                  {airport.name}, {airport.country}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </FormField>
  );
}
