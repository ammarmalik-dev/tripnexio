import { Plane } from "lucide-react";
import type { StoredItinerarySegment } from "@/lib/quotations/itinerary";
import { AirlineLogo } from "@/components/ui/AirlineLogo";

/** Airline name + logo per IATA code (Airline master). */
type AirlineDisplayMap = Record<string, { name: string; logoUrl: string | null }>;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * P22 item 7 — read-only multi-sector itinerary, shared by the CRM QuoteCard
 * and the customer quote page. Every field rendered here is customer-safe by
 * design (itinerarySegmentSchema carries no cost/vendor data).
 */
export function ItinerarySectors({
  segments,
  title = "Itinerary",
  airlines = {},
}: {
  segments: StoredItinerarySegment[];
  title?: string;
  airlines?: AirlineDisplayMap;
}) {
  if (segments.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink-heading">
        {title} · {segments.length} {segments.length === 1 ? "sector" : "sectors"}
      </span>
      <ol className="flex flex-col gap-2">
        {segments.map((segment, index) => (
          <li key={`${index}-${segment.from}-${segment.to}`} className="flex gap-3 rounded-lg bg-surface-2 p-3 text-xs">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-1 text-[11px] font-semibold text-ink-accent"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                {segment.from}
                <Plane className="h-3.5 w-3.5 text-ink-tertiary" aria-label="to" />
                {segment.to}
              </span>
              {segment.airline || segment.flightNumber ? (
                <span className="flex items-center gap-1.5 text-ink-secondary">
                  {segment.airline ? (
                    <AirlineLogo
                      src={airlines[segment.airline.toUpperCase()]?.logoUrl}
                      name={airlines[segment.airline.toUpperCase()]?.name ?? segment.airline}
                      className="h-5 w-5"
                    />
                  ) : null}
                  {[segment.airline ? (airlines[segment.airline.toUpperCase()]?.name ?? segment.airline) : null, segment.flightNumber]
                    .filter(Boolean)
                    .join(" ")}
                </span>
              ) : null}
              {segment.departAt || segment.arriveAt ? (
                <span className="text-ink-tertiary">
                  {segment.departAt ? `Departs ${formatDateTime(segment.departAt)}` : ""}
                  {segment.departAt && segment.arriveAt ? " · " : ""}
                  {segment.arriveAt ? `Arrives ${formatDateTime(segment.arriveAt)}` : ""}
                </span>
              ) : null}
              {segment.notes ? <span className="whitespace-pre-line text-ink-secondary">{segment.notes}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
