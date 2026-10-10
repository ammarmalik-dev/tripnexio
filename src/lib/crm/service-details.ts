import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client testing 2026-10-09 (E13) — the short "Service Details" line in the
 * CRM lists (the client's table sample): what was asked for, read only from
 * what the intake stored, e.g. "Tourist | 30 Days · Single Entry",
 * "Air Arabia · Travel 12 Oct 2026", "BOM – DXB · Travel 10 Nov 2026",
 * "To United Arab Emirates · Return 4 Jan 2027". Null when nothing is known.
 * Pure (no DB) so the list APIs and their CSV exports can share it.
 */
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function day(value: unknown): string | null {
  const iso = text(value);
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Dubai - Dubai International Airport (DXB)" → "DXB"; anything else as typed. */
function place(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return raw.match(/\(([A-Z0-9]{3})\)\s*$/)?.[1] ?? raw;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function serviceDetailsLine(serviceType: ServiceType, details: unknown, extra: { airlineName?: string | null } = {}): string | null {
  const data = (details && typeof details === "object" && !Array.isArray(details) ? details : {}) as Record<string, unknown>;
  const join = (parts: (string | null)[], separator = " · ") => {
    const kept = parts.filter((part): part is string => Boolean(part));
    return kept.length > 0 ? kept.join(separator) : null;
  };
  const travel = day(data.travelDate);

  switch (serviceType) {
    case "NEW_VISA": {
      const visaType = text(data.visaType);
      return join([visaType ? capitalise(visaType) : null, text(data.visaOption)], " | ");
    }
    case "OTB":
      return join([extra.airlineName ?? text(data.airline), travel ? `Travel ${travel}` : null]);
    case "RETURN_TICKET": {
      const returnDay = day(data.expectedReturnDate);
      return join([text(data.destinationCountry) ? `To ${text(data.destinationCountry)}` : null, returnDay ? `Return ${returnDay}` : null]);
    }
    case "FLIGHT_SPECIAL_FARE": {
      const from = place(data.origin);
      const to = place(data.destination);
      return join([from && to ? `${from} – ${to}` : (from ?? to), travel ? `Travel ${travel}` : null]);
    }
    case "VISA_EXTENSION": {
      const expiry = day(data.visaExpiryDate);
      return expiry ? `Visa expires ${expiry}` : "30 Days Extension";
    }
    case "VISA_CHANGE": {
      const nationality = text(data.nationalityName) ?? text(data.nationality);
      return join([nationality, travel ? `Travel ${travel}` : null]);
    }
    default:
      return null;
  }
}
