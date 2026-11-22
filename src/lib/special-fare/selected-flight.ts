import { db } from "../db";
import { airportCities, cityFor } from "../airports/city-route";
import { isRoundTrip, parseStoredItinerary } from "../quotations/itinerary";
import { formatBusinessDateTime } from "../format-business-time";

export interface SelectedFlightLeg {
  label: "Departure" | "Return" | "Connection";
  route: string;
  flight: string | null;
  departAt: string | null;
  arriveAt: string | null;
}

export interface SelectedFlightView {
  tripType: "One-way" | "Round trip";
  pax: number | null;
  legs: SelectedFlightLeg[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A sector time as staff typed it ("2026-12-01T10:30", local to the airport) → "1 Dec 2026, 10:30". */
function sectorTime(value: string | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return value?.trim() || null;
  const [, year, month, day, hour, minute] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}${hour ? `, ${hour}:${minute}` : ""}`;
}

/**
 * Client doc 16 Nov (A10) — the selected flight on the payment page: one-way / round trip, airline + flight number,
 * departure / arrival cities (not airport codes), dates, times and PAX. Customer-safe fields only. null when the lead
 * has no selected Special Fare quotation.
 */
export async function selectedFlightView(leadId: string, pax: number | null): Promise<SelectedFlightView | null> {
  const quotation = await db.quotation.findFirst({
    where: { leadId, isSelected: true },
    select: { airline: true, flightNumber: true, route: true, flightDateTime: true, arrivalDateTime: true, itinerary: true },
  });
  if (!quotation) return null;
  const sectors = parseStoredItinerary(quotation.itinerary);
  if (sectors.length > 0) {
    const cities = await airportCities(sectors.flatMap((sector) => [sector.from, sector.to]));
    let seenReturn = false;
    const legs = sectors.map((sector, index): SelectedFlightLeg => {
      const isReturn = sector.leg === "RETURN";
      const label = index === 0 ? "Departure" : isReturn && !seenReturn ? "Return" : "Connection";
      if (isReturn) seenReturn = true;
      return {
        label,
        route: `${cityFor(sector.from, cities)} → ${cityFor(sector.to, cities)}`,
        flight: [sector.airline ?? quotation.airline, sector.flightNumber].filter(Boolean).join(" ") || null,
        departAt: sectorTime(sector.departAt),
        arriveAt: sectorTime(sector.arriveAt),
      };
    });
    return { tripType: isRoundTrip(sectors) ? "Round trip" : "One-way", pax, legs };
  }
  const [from, to] = (quotation.route ?? "").split(/→|-/).map((part) => part.trim());
  const cities = await airportCities([from, to].filter(Boolean));
  return {
    tripType: "One-way",
    pax,
    legs: [
      {
        label: "Departure",
        route: from && to ? `${cityFor(from, cities)} → ${cityFor(to, cities)}` : (quotation.route ?? "—"),
        flight: [quotation.airline, quotation.flightNumber].filter(Boolean).join(" ") || null,
        departAt: quotation.flightDateTime ? await formatBusinessDateTime(quotation.flightDateTime) : null,
        arriveAt: quotation.arrivalDateTime ? await formatBusinessDateTime(quotation.arrivalDateTime) : null,
      },
    ],
  };
}
