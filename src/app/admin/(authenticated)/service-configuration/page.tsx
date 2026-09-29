import type { Metadata } from "next";
import { ServiceConfigurationHub } from "@/components/admin/ServiceConfigurationHub";
import { parseServiceConfigService, parseServiceConfigTab } from "@/lib/admin/service-configuration";

export const metadata: Metadata = { title: "Service Configuration | Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * P23 item 1 (Admin FINAL handover §3) — the one central Service
 * Configuration screen. The old per-setting pages (Pricing, Document
 * Requirements, Timelines, Service Statuses, Service Terms, Refund Config,
 * Protection Plan, New Visa Countries, Return Ticket Destinations, OTB
 * Prices) now redirect here with the matching tab preselected.
 */
export default async function AdminServiceConfigurationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const service = parseServiceConfigService(single(params.service));
  const tab = parseServiceConfigTab(service, single(params.tab));
  const rawCountry = single(params.country) ?? "";
  // Only an id-shaped value is passed on; the hub's picker is the source of truth for real country ids.
  const country = /^[A-Za-z0-9_-]{1,64}$/.test(rawCountry) ? rawCountry : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Service Configuration</h1>
        <p className="text-sm text-ink-tertiary">
          Pick a service — and a destination country where it applies — to manage its pricing, documents, timelines,
          statuses, terms, processing options, sub-services and refund rules in one place. Changes apply to new
          requests only; existing paid, confirmed and in-process bookings keep the configuration they were created
          with.
        </p>
      </div>
      <ServiceConfigurationHub initialService={service} initialCountry={country} initialTab={tab} />
    </div>
  );
}
