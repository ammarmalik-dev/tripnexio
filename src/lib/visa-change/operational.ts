/**
 * P14 — Visa Change operational blocks (Visa_Change.md §6/§9/§10/§13/§21).
 * Staff fill one per lead from the CRM panel that matches the customer's
 * chosen method (Lead.details.changeType): Airport-to-Airport or Border Exit.
 * It is mandatory before quoting, copied onto each quotation option
 * (Quotation.operationalBlock), shown to the customer per option, and
 * printed on the package PDF. Vendor, cost and selling price are internal:
 * customerBlockRows() never includes them.
 */

/**
 * Client corrections 2026-10-05 §8 — one complete round-trip itinerary is the
 * A2A operational record: the onward flight (out of the UAE, from the exit
 * airport) and the return flight (back in, to the re-entry airport).
 * `airlineCode`/`flightNumber`/`flightDate`/`flightTime` are the onward leg;
 * the `return*` fields the return leg (absent on blocks saved before this).
 */
export interface A2ABlock {
  kind: "A2A";
  /** Re-entry airport (where the return flight lands). */
  entryAirportId: string;
  entryAirport: string;
  /** Exit airport (where the onward flight departs). */
  exitAirportId: string;
  exitAirport: string;
  airlineCode: string;
  airline: string;
  flightNumber: string;
  /** YYYY-MM-DD */
  flightDate: string;
  /** HH:MM (24h) */
  flightTime: string;
  returnAirlineCode?: string | null;
  returnAirline?: string | null;
  returnFlightNumber?: string | null;
  returnFlightDate?: string | null;
  returnFlightTime?: string | null;
  reportingTime: string;
  vendorId: string;
  vendorName: string;
  cost: number;
  sellingPrice: number;
  instructions?: string | null;
}

export interface BorderBlock {
  kind: "BORDER";
  borderId: string;
  borderName: string;
  /** Client corrections 2026-10-05 — the non-UAE side country (from the Border master; mandatory). */
  borderCountryName?: string | null;
  pickupLocation: string;
  /** Client corrections 2026-10-05 — full pickup address and the vehicle number. */
  pickupAddress?: string | null;
  vehicleNumber?: string | null;
  pickupPersonName: string;
  pickupPersonContact?: string | null;
  customerContactNumber: string;
  reportingTime: string;
  travelTime: string;
  dropLocation?: string | null;
  busOperator?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  instructions?: string | null;
}

export type OperationalBlock = A2ABlock | BorderBlock;

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Parses a stored block (lead panel or quotation snapshot); null when it's missing or incomplete. */
export function parseOperationalBlock(raw: unknown): OperationalBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.kind === "A2A") {
    const required = ["entryAirportId", "entryAirport", "exitAirportId", "exitAirport", "airlineCode", "airline", "flightNumber", "flightDate", "flightTime", "reportingTime", "vendorId", "vendorName"];
    if (required.some((key) => !str(data[key])) || num(data.cost) === null || num(data.sellingPrice) === null) return null;
    return data as unknown as A2ABlock;
  }
  if (data.kind === "BORDER") {
    const required = ["borderId", "borderName", "pickupLocation", "pickupPersonName", "customerContactNumber", "reportingTime", "travelTime"];
    if (required.some((key) => !str(data[key]))) return null;
    return data as unknown as BorderBlock;
  }
  return null;
}

/** The complete operational block staff saved on the lead for its chosen method, or null. */
export function leadOperationalBlock(details: unknown): OperationalBlock | null {
  const data = (details ?? {}) as Record<string, unknown>;
  if (data.changeType === "AIRPORT_TO_AIRPORT") return parseOperationalBlock(data.a2aOperationalDetails);
  if (data.changeType === "BORDER_EXIT") return parseOperationalBlock(data.borderOperationalDetails);
  return null;
}

/** P14 — why a Visa Change lead can't be quoted yet (null when its operational details are complete). */
export function visaChangeQuoteBlockReason(serviceType: string, details: unknown): string | null {
  if (serviceType !== "VISA_CHANGE") return null;
  if (leadOperationalBlock(details)) return null;
  const changeType = ((details ?? {}) as Record<string, unknown>).changeType;
  return changeType === "BORDER_EXIT"
    ? "Complete the Border Exit operational details (including travel time) before quoting."
    : "Complete the Airport-to-Airport operational details before quoting.";
}

export function formatFlightDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** The customer-safe rows of a block — shown on the quote page and printed on the package PDF. Never vendor, cost or price. */
export function customerBlockRows(block: OperationalBlock): { label: string; value: string }[] {
  if (block.kind === "A2A") {
    // Client correction 2026-10-05: a round trip from and back to one airport shows it once.
    const airportRows =
      block.entryAirportId === block.exitAirportId
        ? [{ label: "Exit & Re-entry Airport", value: block.exitAirport }]
        : [
            { label: "Exit Airport", value: block.exitAirport },
            { label: "Re-entry Airport", value: block.entryAirport },
          ];
    const returnLeg =
      block.returnFlightNumber && block.returnFlightDate
        ? [
            {
              label: "Return Flight",
              value: `${block.returnAirline ?? block.airline} ${block.returnFlightNumber} · ${formatFlightDate(block.returnFlightDate)}${block.returnFlightTime ? ` ${block.returnFlightTime}` : ""}`,
            },
          ]
        : [];
    return [
      ...airportRows,
      { label: returnLeg.length > 0 ? "Onward Flight" : "Flight", value: `${block.airline} ${block.flightNumber} · ${formatFlightDate(block.flightDate)} ${block.flightTime}` },
      ...returnLeg,
      { label: "Reporting Time", value: block.reportingTime },
    ];
  }
  const rows: { label: string; value: string | null | undefined }[] = [
    { label: "Border", value: block.borderName },
    { label: "Country (non-UAE side)", value: block.borderCountryName },
    { label: "Pickup Location", value: block.pickupLocation },
    { label: "Pickup Address", value: block.pickupAddress },
    { label: "Vehicle Number", value: block.vehicleNumber },
    { label: "Pickup Person", value: block.pickupPersonName },
    { label: "Pickup Contact Number", value: block.pickupPersonContact },
    { label: "Reporting Time", value: block.reportingTime },
    { label: "Travel Time", value: block.travelTime },
    { label: "Drop / Border Location", value: block.dropLocation },
    { label: "Bus / Operator", value: block.busOperator },
  ];
  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

export const OPERATIONAL_BLOCK_TITLE: Record<OperationalBlock["kind"], string> = {
  A2A: "Airport-to-Airport",
  BORDER: "Border Exit",
};
