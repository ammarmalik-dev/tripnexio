import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P23 item 1 — the Service Configuration hub's tab catalogue. Plain data (no
 * React) so both the server page (URL validation) and the client hub share it.
 */
export type ServiceConfigTab =
  | "pricing"
  | "documents"
  | "timelines"
  | "statuses"
  | "terms"
  | "processing"
  | "sub-services"
  | "refunds"
  | "protection-plan"
  | "countries"
  | "destinations"
  | "otb-prices"
  | "otb-rules";

export const SERVICE_CONFIG_TAB_LABELS: Record<ServiceConfigTab, string> = {
  pricing: "Pricing",
  documents: "Documents",
  timelines: "Timelines",
  statuses: "Statuses",
  terms: "Terms",
  processing: "Processing options",
  "sub-services": "Sub-services",
  refunds: "Refund config",
  "protection-plan": "Protection Plan",
  countries: "New Visa Countries",
  destinations: "Destinations",
  "otb-prices": "OTB Prices",
  "otb-rules": "OTB Rules",
};

/** Every bookable service module (the Services master's codes, minus the catch-all OTHER). */
export const SERVICE_CONFIG_SERVICES: ServiceType[] = [
  "NEW_VISA",
  "VISA_EXTENSION",
  "VISA_CHANGE",
  "FLIGHT_SPECIAL_FARE",
  "RETURN_TICKET",
  "OTB",
];

const COMMON_TABS: ServiceConfigTab[] = [
  "pricing",
  "documents",
  "timelines",
  "statuses",
  "terms",
  "processing",
  "sub-services",
  "refunds",
];

const SERVICE_SPECIFIC_TABS: Partial<Record<ServiceType, ServiceConfigTab[]>> = {
  NEW_VISA: ["countries", "protection-plan"],
  RETURN_TICKET: ["destinations"],
  OTB: ["otb-prices", "otb-rules"],
};

/** Tabs whose manager accepts a destination-country filter — the hub shows its country picker only on these. */
export const COUNTRY_SCOPED_TABS: ReadonlySet<ServiceConfigTab> = new Set<ServiceConfigTab>([
  "documents",
  "terms",
  "protection-plan",
  "countries",
  "destinations",
  "otb-prices",
]);

export function getServiceConfigTabs(service: ServiceType): ServiceConfigTab[] {
  return [...COMMON_TABS, ...(SERVICE_SPECIFIC_TABS[service] ?? [])];
}

export function parseServiceConfigService(value: string | undefined): ServiceType {
  return SERVICE_CONFIG_SERVICES.find((service) => service === value) ?? "NEW_VISA";
}

export function parseServiceConfigTab(service: ServiceType, value: string | undefined): ServiceConfigTab {
  const tabs = getServiceConfigTabs(service);
  return tabs.find((tab) => tab === value) ?? tabs[0];
}

/** Builds a hub link — used by the old per-setting pages' redirects. */
export function serviceConfigHref(tab: ServiceConfigTab, service?: ServiceType): string {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  params.set("tab", tab);
  return `/admin/service-configuration?${params.toString()}`;
}
