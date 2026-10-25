"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ReportFilterKey } from "@/lib/reports/types";

export interface ReportFilterValues {
  from: string;
  to: string;
  serviceType: string;
  countryId: string;
  staffId: string;
  vendorId: string;
  /** Admin handover §15 — "SERVICE_TYPE:code". */
  subService: string;
  leadStatus: string;
  bookingStatus: string;
  paymentStatus: string;
}

interface Option {
  value: string;
  label: string;
  /** Sub-service options only: the service they belong to. */
  serviceType?: string;
}

interface FilterOptions {
  services: Option[];
  countries: Option[];
  staff: Option[];
  vendors: Option[];
  subServices: Option[];
  leadStatuses: Option[];
  bookingStatuses: Option[];
  paymentStatuses: Option[];
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Default range: the last 30 days ending today (matches the API's own default). */
export function defaultReportFilters(): ReportFilterValues {
  const today = new Date();
  const from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    from: isoDay(from),
    to: isoDay(today),
    serviceType: "",
    countryId: "",
    staffId: "",
    vendorId: "",
    subService: "",
    leadStatus: "",
    bookingStatus: "",
    paymentStatus: "",
  };
}

/** Query string for the report APIs — only non-empty values, and only the optional filters listed in `supported`. */
export function reportQueryString(values: ReportFilterValues, supported: ReportFilterKey[]): string {
  const params = new URLSearchParams({ from: values.from, to: values.to });
  for (const key of supported) {
    if (values[key]) params.set(key, values[key]);
  }
  return params.toString();
}

const FILTER_META: Record<ReportFilterKey, { label: string; allLabel: string; optionsKey: keyof FilterOptions }> = {
  serviceType: { label: "Service", allLabel: "All services", optionsKey: "services" },
  countryId: { label: "Country", allLabel: "All countries", optionsKey: "countries" },
  staffId: { label: "Staff", allLabel: "All staff", optionsKey: "staff" },
  vendorId: { label: "Vendor", allLabel: "All vendors", optionsKey: "vendors" },
  subService: { label: "Sub-service", allLabel: "All sub-services", optionsKey: "subServices" },
  leadStatus: { label: "Lead status", allLabel: "All lead statuses", optionsKey: "leadStatuses" },
  bookingStatus: { label: "Booking status", allLabel: "All booking statuses", optionsKey: "bookingStatuses" },
  paymentStatus: { label: "Payment status", allLabel: "All payment statuses", optionsKey: "paymentStatuses" },
};

/** Sub-services narrow to the picked service (when the report has a service filter and one is chosen). */
function optionsFor(key: ReportFilterKey, options: FilterOptions, values: ReportFilterValues): Option[] {
  const list = options[FILTER_META[key].optionsKey] ?? [];
  if (key === "subService" && values.serviceType) return list.filter((option) => option.serviceType === values.serviceType);
  return list;
}

interface ReportFilterBarProps {
  values: ReportFilterValues;
  supportedFilters: ReportFilterKey[];
  onChange: (values: ReportFilterValues) => void;
  onRefresh: () => void;
  /** Extra controls on the right (e.g. an Export CSV link). */
  actions?: React.ReactNode;
}

/**
 * P25 — the shared report filter bar: date range always, plus only the
 * optional filters the report supports. Dropdown options come from
 * /api/admin/reports/filters; if they fail to load, the date range still works.
 */
export function ReportFilterBar({ values, supportedFilters, onChange, onRefresh, actions }: ReportFilterBarProps) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const needsOptions = supportedFilters.length > 0;

  useEffect(() => {
    if (!needsOptions) return;
    let cancelled = false;
    async function loadOptions() {
      try {
        const result = await getJson<FilterOptions>("/api/admin/reports/filters");
        if (!cancelled) setOptions(result);
      } catch {
        if (!cancelled) setOptionsFailed(true);
      }
    }
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [needsOptions]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="From"
          name="report-from"
          type="date"
          value={values.from}
          max={values.to}
          onChange={(event) => onChange({ ...values, from: event.target.value })}
        />
        <TextField
          label="To"
          name="report-to"
          type="date"
          value={values.to}
          min={values.from}
          onChange={(event) => onChange({ ...values, to: event.target.value })}
        />
        {supportedFilters.map((key) => {
          const meta = FILTER_META[key];
          const list = options ? optionsFor(key, options, values) : [];
          const id = `report-${key}`;
          return (
            <FormField key={key} label={meta.label} htmlFor={id}>
              <div className="relative">
                <select
                  id={id}
                  name={id}
                  value={values[key]}
                  disabled={!options}
                  onChange={(event) => {
                    const next = { ...values, [key]: event.target.value };
                    // A sub-service belongs to one service: changing the service drops a sub-service of another one.
                    if (key === "serviceType" && next.subService && !next.subService.startsWith(`${event.target.value}:`)) next.subService = "";
                    onChange(next);
                  }}
                  className={cn(fieldControlClass, fieldBorderClass(false), "appearance-none pr-9")}
                >
                  <option value="">{options ? meta.allLabel : optionsFailed ? "Unavailable" : "Loading…"}</option>
                  {list.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
              </div>
            </FormField>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onRefresh}>
          Refresh
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(defaultReportFilters())}>
          Reset
        </Button>
        {optionsFailed ? <span className="text-xs text-error">Couldn&apos;t load filter options — date range still applies.</span> : null}
        {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
