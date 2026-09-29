"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, ApiError } from "@/lib/api/client";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import {
  SERVICE_CONFIG_SERVICES,
  COUNTRY_SCOPED_TABS,
  SERVICE_CONFIG_TAB_LABELS,
  getServiceConfigTabs,
  type ServiceConfigTab,
} from "@/lib/admin/service-configuration";
import type { ServiceType } from "../../generated/prisma/enums";
import { PricingRulesManager } from "./PricingRulesManager";
import { DocumentRequirementsManager } from "./DocumentRequirementsManager";
import { ServiceTimelinesManager } from "./ServiceTimelinesManager";
import { ServiceStatusesManager } from "./ServiceStatusesManager";
import { ServiceTermsManager } from "./ServiceTermsManager";
import { RefundConfigManager } from "./RefundConfigManager";
import { ProtectionPlanConfigManager } from "./ProtectionPlanConfigManager";
import { ProtectionPlanCountriesManager } from "./ProtectionPlanCountriesManager";
import { NewVisaCountriesManager } from "./NewVisaCountriesManager";
import { ReturnTicketDestinationsManager } from "./ReturnTicketDestinationsManager";
import { OtbPricesManager } from "./OtbPricesManager";
import { OtbRulesManager } from "./OtbRulesManager";
import { SubServicesManager } from "@/components/admin/SubServicesManager";
import { ProcessingTypesManager } from "@/components/admin/ProcessingTypesManager";

interface CountryOption {
  id: string;
  name: string;
  active: boolean;
}

type CountryLoadState = "loading" | "success" | "error";

/** One-line context shown above each tab's manager. */
const TAB_DESCRIPTIONS: Record<ServiceConfigTab, string> = {
  pricing:
    "The central pricing control for every auto-priced service (it has its own service / country filters). Editing a rule never changes an already-quoted or paid booking's price.",
  documents:
    "The document checklist for this service. Picking a country shows that country's rules plus the all-countries ones. Use Bulk Apply to copy a checklist onto other services in one action.",
  timelines: "Document verification, completion, quotation-response and payment-deadline times for this service.",
  statuses: "This service's Lead and Booking status lists and transition rules. The CRM Change Status control offers only the transitions configured here.",
  terms:
    "Versioned Terms & Conditions the customer agrees to before paying. Versions are never edited — publish a new one; every booking keeps the version the customer agreed to.",
  processing: "Processing options (e.g. normal / express) offered for this service.",
  "sub-services": "Sub-services under this service.",
  refunds: "The refund rule the CRM refund calculator uses for this service.",
  "protection-plan": "New Visa's per-passenger Protection Plan add-on — enable it per destination country; the defaults apply where a country has no override.",
  countries:
    "The countries New Visa is offered for, and each country's products. Prices, documents and timelines for a country are set on the Pricing, Documents and Timelines tabs.",
  destinations: "The countries customers can request a Return Verified Ticket for, the rate per applicant, and the visa-validity options.",
  "otb-prices":
    "OTB price per airline, destination country and passenger type. Where no active price matches, the airline's own normal / urgent price (Airlines master) is charged.",
  "otb-rules": "Standard and urgent OTB processing times in working days/hours (Mon-Fri). Each airline can override these on the Airlines master.",
};

function buildUrl(service: ServiceType, country: string, tab: ServiceConfigTab): string {
  const params = new URLSearchParams({ service });
  if (country) params.set("country", country);
  params.set("tab", tab);
  return `/admin/service-configuration?${params.toString()}`;
}

function TabPanelContent({ service, country, tab }: { service: ServiceType; country: string; tab: ServiceConfigTab }) {
  const countryId = country || undefined;
  switch (tab) {
    case "pricing":
      return (
        <div className="flex flex-col gap-3">
          {service === "OTB" || service === "RETURN_TICKET" ? (
            <p className="rounded-lg border border-hairline bg-surface-1 p-3 text-xs text-ink-secondary">
              {service === "OTB"
                ? "OTB is priced per airline and destination — see the OTB Prices tab."
                : "Return Ticket uses a flat per-country rate — see the Destinations tab."}{" "}
              The rules below cover the other auto-priced services.
            </p>
          ) : null}
          <PricingRulesManager />
        </div>
      );
    case "documents":
      return <DocumentRequirementsManager serviceType={service} countryId={countryId} />;
    case "timelines":
      return <ServiceTimelinesManager serviceType={service} />;
    case "statuses":
      return <ServiceStatusesManager serviceType={service} />;
    case "terms":
      return <ServiceTermsManager serviceType={service} countryId={countryId} />;
    case "processing":
      return <ProcessingTypesManager serviceType={service} />;
    case "sub-services":
      return <SubServicesManager serviceType={service} />;
    case "refunds":
      return <RefundConfigManager serviceType={service} />;
    case "protection-plan":
      return (
        <div className="flex flex-col gap-6">
          <ProtectionPlanCountriesManager countryId={countryId} />
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-heading">Defaults</h3>
            <ProtectionPlanConfigManager />
          </div>
        </div>
      );
    case "countries":
      return <NewVisaCountriesManager countryId={countryId} />;
    case "destinations":
      return <ReturnTicketDestinationsManager countryId={countryId} />;
    case "otb-prices":
      return <OtbPricesManager countryId={countryId} />;
    case "otb-rules":
      return <OtbRulesManager />;
  }
}

/**
 * P23 item 1 (Admin FINAL handover §3) — ONE central Service Configuration
 * hub. Pick a service (and, where a tab is country-scoped, a destination
 * country) and manage every per-service setting from one screen instead of a
 * long sidebar of separate pages. Each tab reuses the existing manager
 * component, scoped by its optional `serviceType` / `countryId` props.
 *
 * Service / country / tab live in the URL (?service=&country=&tab=) so a view
 * is shareable. Updates use `history.replaceState` (Next.js syncs it with its
 * router) — no server round-trip on every tab click.
 *
 * The hub only edits configuration; existing bookings keep the values they
 * were created with (every manager's own save path already guarantees that).
 */
export function ServiceConfigurationHub({
  initialService,
  initialCountry,
  initialTab,
}: {
  initialService: ServiceType;
  initialCountry: string;
  initialTab: ServiceConfigTab;
}) {
  const [service, setService] = useState<ServiceType>(initialService);
  const [country, setCountry] = useState(initialCountry);
  const [tab, setTab] = useState<ServiceConfigTab>(initialTab);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryState, setCountryState] = useState<CountryLoadState>("loading");
  const [countryError, setCountryError] = useState("");
  const tabRefs = useRef<Map<ServiceConfigTab, HTMLButtonElement>>(new Map());

  const tabs = getServiceConfigTabs(service);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const showCountry = COUNTRY_SCOPED_TABS.has(activeTab);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getJson<CountryOption[]>("/api/admin/countries");
        if (cancelled) return;
        setCountries(rows.filter((row) => row.active));
        setCountryState("success");
      } catch (error) {
        if (cancelled) return;
        setCountryError(error instanceof ApiError ? error.message : "Couldn't load countries.");
        setCountryState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const next = buildUrl(service, country, activeTab);
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [service, country, activeTab]);

  const selectTab = (next: ServiceConfigTab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current.get(next)?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.indexOf(activeTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(tabs[nextIndex], true);
  };

  let countryControl: ReactNode = null;
  if (showCountry) {
    countryControl = (
      <FormField label="Destination country (optional)" htmlFor="service-config-country" error={countryState === "error" ? countryError : undefined}>
        <select
          id="service-config-country"
          value={country}
          disabled={countryState !== "success"}
          onChange={(event) => setCountry(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(countryState === "error"))}
        >
          <option value="">{countryState === "loading" ? "Loading countries…" : "All countries"}</option>
          {countries.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  const panelId = `service-config-panel-${activeTab}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <FormField label="Service" htmlFor="service-config-service">
          <select
            id="service-config-service"
            value={service}
            onChange={(event) => setService(event.target.value as ServiceType)}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            {SERVICE_CONFIG_SERVICES.map((value) => (
              <option key={value} value={value}>
                {SERVICE_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </FormField>
        {countryControl}
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div role="tablist" aria-label={`${SERVICE_TYPE_LABELS[service]} configuration`} className="flex w-max gap-1 border-b border-hairline">
          {tabs.map((option) => {
            const selected = option === activeTab;
            return (
              <button
                key={option}
                ref={(node) => {
                  if (node) tabRefs.current.set(option, node);
                  else tabRefs.current.delete(option);
                }}
                type="button"
                role="tab"
                id={`service-config-tab-${option}`}
                aria-selected={selected}
                aria-controls={`service-config-panel-${option}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(option)}
                onKeyDown={handleTabKeyDown}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  selected ? "border-accent text-ink-heading" : "border-transparent text-ink-tertiary hover:text-ink-secondary",
                )}
              >
                {SERVICE_CONFIG_TAB_LABELS[option]}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={`service-config-tab-${activeTab}`} tabIndex={0} className="flex flex-col gap-4 focus-visible:outline-none">
        <p className="text-sm text-ink-tertiary">{TAB_DESCRIPTIONS[activeTab]}</p>
        <TabPanelContent key={`${service}-${country}-${activeTab}`} service={service} country={country} tab={activeTab} />
      </div>
    </div>
  );
}
