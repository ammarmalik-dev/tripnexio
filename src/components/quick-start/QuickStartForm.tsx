"use client";

import { useId, useMemo, type ReactNode, type SelectHTMLAttributes } from "react";
import {
  CalendarClock,
  ChevronDown,
  FileText,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";
import { useQuickStart } from "./QuickStartProvider";
import {
  FLIGHTS_DESTINATION,
  OTB_DESTINATION,
  SAMPLE_AIRLINE_OPTIONS,
  SAMPLE_AIRPORT_OPTIONS,
  SAMPLE_DATA_CAPTION,
  SERVICE_TABS,
  VISA_SERVICE_OPTIONS,
  type SelectOption,
} from "@/lib/quick-start-config";

// text-left guards against an ancestor's text-align: center (e.g. the
// hero section) bleeding into the caption/value text.
const pillClass =
  "flex min-w-0 flex-1 items-center gap-2.5 rounded-pill border border-glass-border bg-white/[0.04] px-3.5 py-2 text-left transition-colors duration-200 focus-within:border-accent-light focus-within:bg-white/[0.06]";

const compactPillClass =
  "flex flex-none items-center gap-2 rounded-pill border border-glass-border bg-white/[0.06] px-2.5 py-1.5 text-left transition-colors duration-200 focus-within:border-accent-light focus-within:bg-white/[0.09]";

const COMPACT_FIELD_WIDTH = "w-28";

interface PillFieldProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  compact?: boolean;
}

/** Atlys-style pill field: icon in a colored circle, caption + value stacked, trailing chevron. */
function PillField({ icon, label, children, compact = false }: PillFieldProps) {
  return (
    <div className={compact ? compactPillClass : pillClass}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-light",
          compact ? "h-6 w-6" : "h-8 w-8"
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className={cn("flex min-w-0 flex-col leading-tight", compact ? "flex-none" : "flex-1")}>
        {!compact ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            {label}
          </span>
        ) : null}
        {children}
      </span>
      <ChevronDown
        className={cn("shrink-0 text-ink-tertiary", compact ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden="true"
      />
    </div>
  );
}

const pillValueClass =
  "w-full appearance-none truncate bg-transparent text-sm font-medium text-ink-primary outline-none [color-scheme:dark]";

interface PillSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

function PillSelect({ options, className, ...props }: PillSelectProps) {
  return (
    <select className={cn(pillValueClass, className)} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-surface-1 text-ink-primary">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface QuickStartFormProps {
  layout?: "horizontal" | "stacked" | "compact";
  onNavigate?: () => void;
  className?: string;
}

export function QuickStartForm({ layout = "horizontal", onNavigate, className }: QuickStartFormProps) {
  const {
    service,
    setService,
    visaService,
    flightFrom,
    flightTo,
    flightDate,
    otbAirline,
    otbDate,
    setField,
  } = useQuickStart();

  const visaId = useId();
  const flightFromId = useId();
  const flightToId = useId();
  const flightDateId = useId();
  const otbAirlineId = useId();
  const otbDateId = useId();

  const href = useMemo(() => {
    if (service === "visa") {
      const opt = VISA_SERVICE_OPTIONS.find((o) => o.value === visaService) ?? VISA_SERVICE_OPTIONS[0];
      return opt.href;
    }
    if (service === "flights") {
      const params = new URLSearchParams({ from: flightFrom, to: flightTo });
      if (flightDate) params.set("date", flightDate);
      return `${FLIGHTS_DESTINATION.href}?${params.toString()}`;
    }
    const params = new URLSearchParams({ airline: otbAirline });
    if (otbDate) params.set("date", otbDate);
    return `${OTB_DESTINATION.href}?${params.toString()}`;
  }, [service, visaService, flightFrom, flightTo, flightDate, otbAirline, otbDate]);

  const buttonLabel =
    service === "visa" ? "Start" : service === "flights" ? "Request fares" : "Start OTB";

  const isStacked = layout === "stacked";
  const isCompact = layout === "compact";
  const shouldReduceMotion = useReducedMotion();

  const valueClass = isCompact ? cn(pillValueClass, COMPACT_FIELD_WIDTH) : pillValueClass;

  return (
    <div className={cn("flex gap-3", isCompact ? "flex-nowrap items-center" : "flex-col", className)}>
      <div
        role="group"
        aria-label="Select a service"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-pill bg-white/[0.04] p-1",
          !isCompact && "w-fit",
          layout === "horizontal" && "self-center",
          isStacked && "self-start"
        )}
      >
        {SERVICE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={service === tab.key}
            onClick={() => setService(tab.key)}
            className={cn(
              "rounded-pill font-medium transition-colors duration-200",
              isCompact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              service === tab.key
                ? "bg-accent text-white"
                : "text-ink-secondary hover:text-ink-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={service}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="will-change-transform flex flex-col gap-2"
        >
      <div
        className={cn(
          "flex gap-3",
          isCompact
            ? "flex-nowrap items-center"
            : isStacked
              ? "flex-col"
              : "flex-col md:flex-row md:flex-wrap md:items-center lg:flex-nowrap"
        )}
      >
        {service === "visa" ? (
          <PillField
            compact={isCompact}
            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            label="Visa service"
          >
            <label htmlFor={visaId} className="sr-only">
              Visa service
            </label>
            <PillSelect
              id={visaId}
              options={VISA_SERVICE_OPTIONS}
              value={visaService}
              onChange={(e) => setField("visaService", e.target.value)}
              className={valueClass}
            />
          </PillField>
        ) : null}

        {service === "flights" ? (
          <>
            <PillField
              compact={isCompact}
              icon={<PlaneTakeoff className="h-4 w-4" aria-hidden="true" />}
              label="From"
            >
              <label htmlFor={flightFromId} className="sr-only">
                From
              </label>
              <PillSelect
                id={flightFromId}
                options={SAMPLE_AIRPORT_OPTIONS}
                value={flightFrom}
                onChange={(e) => setField("flightFrom", e.target.value)}
                className={valueClass}
              />
            </PillField>
            <PillField
              compact={isCompact}
              icon={<PlaneLanding className="h-4 w-4" aria-hidden="true" />}
              label="To"
            >
              <label htmlFor={flightToId} className="sr-only">
                To
              </label>
              <PillSelect
                id={flightToId}
                options={SAMPLE_AIRPORT_OPTIONS}
                value={flightTo}
                onChange={(e) => setField("flightTo", e.target.value)}
                className={valueClass}
              />
            </PillField>
            <PillField
              compact={isCompact}
              icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              label="Travel date"
            >
              <label htmlFor={flightDateId} className="sr-only">
                Travel date
              </label>
              <input
                id={flightDateId}
                type="date"
                className={valueClass}
                value={flightDate}
                onChange={(e) => setField("flightDate", e.target.value)}
              />
            </PillField>
          </>
        ) : null}

        {service === "otb" ? (
          <>
            <PillField
              compact={isCompact}
              icon={<Plane className="h-4 w-4" aria-hidden="true" />}
              label="Airline"
            >
              <label htmlFor={otbAirlineId} className="sr-only">
                Airline
              </label>
              <PillSelect
                id={otbAirlineId}
                options={SAMPLE_AIRLINE_OPTIONS}
                value={otbAirline}
                onChange={(e) => setField("otbAirline", e.target.value)}
                className={valueClass}
              />
            </PillField>
            <PillField
              compact={isCompact}
              icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              label="Travel date"
            >
              <label htmlFor={otbDateId} className="sr-only">
                Travel date
              </label>
              <input
                id={otbDateId}
                type="date"
                className={valueClass}
                value={otbDate}
                onChange={(e) => setField("otbDate", e.target.value)}
              />
            </PillField>
          </>
        ) : null}

        <ButtonLink
          href={href}
          variant="primary"
          size={isCompact ? "sm" : "md"}
          onClick={onNavigate}
          className={isCompact ? "shrink-0" : isStacked ? "w-full" : "w-full shrink-0 md:w-auto"}
        >
          {buttonLabel}
        </ButtonLink>
      </div>

          {service !== "visa" && !isCompact ? (
            <p className="text-xs text-ink-muted">{SAMPLE_DATA_CAPTION}</p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
