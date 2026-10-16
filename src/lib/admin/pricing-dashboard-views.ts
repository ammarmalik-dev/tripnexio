/** The Pricing Dashboard's views — plain data so the server page can read ?view= (client doc 2026-10-15, J10). */
export const PRICING_DASHBOARD_VIEWS = [
  { id: "countries", label: "By country" },
  { id: "table", label: "All prices (table)" },
  { id: "otb", label: "OTB (country × airline)" },
  { id: "return-ticket", label: "Return Ticket (country)" },
  { id: "vendor-rates", label: "Vendor rates (OTB / Return Ticket)" },
] as const;

export type PricingDashboardView = (typeof PRICING_DASHBOARD_VIEWS)[number]["id"];

export function parsePricingDashboardView(value: string | undefined): PricingDashboardView {
  return PRICING_DASHBOARD_VIEWS.find((option) => option.id === value)?.id ?? "countries";
}
