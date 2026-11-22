import { db } from "../db";
import { getOcrProvider } from "../ocr/get-provider";
import { namesMatch } from "../ocr/cross-check";
import type { TicketOcrFields } from "../ocr/types";
import { parseStoredItinerary } from "../quotations/itinerary";
import { sniffMimeType } from "../uploads/validate-upload";

export interface TicketExpected {
  passengerNames: string[];
  pnr: string | null;
  /** Airport codes of the first (outbound) sector. */
  from: string | null;
  to: string | null;
  /** YYYY-MM-DD of the first departure. */
  departureDate: string | null;
}

export interface TicketMismatch {
  field: string;
  expected: string;
  ticket: string;
}

const alnum = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const airportCode = (value: string | null | undefined) => {
  const match = value?.toUpperCase().match(/\b([A-Z]{3})\b/);
  return match ? match[1] : null;
};
const isoDay = (value: string | null | undefined) => value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

/**
 * Client doc 16 Nov (A6) — "while uploading a ticket, compare the ticket details with the documents and information
 * provided by the customer; if any details do not match, show a clear error and prevent the upload". Pure: only the
 * fields both sides have are compared (a ticket the OCR couldn't read fully is never blocked on a guess).
 */
export function compareTicket(ticket: TicketOcrFields, expected: TicketExpected): TicketMismatch[] {
  const mismatches: TicketMismatch[] = [];
  if (ticket.passengerName && expected.passengerNames.length > 0 && !expected.passengerNames.some((name) => namesMatch(name, ticket.passengerName as string))) {
    mismatches.push({ field: "Passenger name", expected: expected.passengerNames.join(", "), ticket: ticket.passengerName });
  }
  if (ticket.pnr && expected.pnr && alnum(ticket.pnr) !== alnum(expected.pnr)) {
    mismatches.push({ field: "PNR", expected: expected.pnr, ticket: ticket.pnr });
  }
  const ticketFrom = airportCode(ticket.departureAirport);
  if (ticketFrom && expected.from && ticketFrom !== expected.from.toUpperCase()) {
    mismatches.push({ field: "Departure airport", expected: expected.from, ticket: ticket.departureAirport ?? ticketFrom });
  }
  const ticketTo = airportCode(ticket.arrivalAirport);
  if (ticketTo && expected.to && ticketTo !== expected.to.toUpperCase()) {
    mismatches.push({ field: "Arrival airport", expected: expected.to, ticket: ticket.arrivalAirport ?? ticketTo });
  }
  const ticketDay = isoDay(ticket.departureDate);
  if (ticketDay && expected.departureDate && ticketDay !== expected.departureDate) {
    mismatches.push({ field: "Departure date", expected: expected.departureDate, ticket: ticketDay });
  }
  return mismatches;
}

export function describeTicketMismatches(mismatches: TicketMismatch[]): string {
  return `The ticket doesn't match this booking — ${mismatches.map((item) => `${item.field}: ticket shows "${item.ticket}", booking has "${item.expected}"`).join("; ")}. Check the file and upload the right ticket.`;
}

/** What the booking says the ticket should show: the selected quotation's first sector, the PNR and the passengers. */
export async function ticketExpectations(leadId: string, pnr: string | null, passengerNames: string[]): Promise<TicketExpected> {
  const quotation = await db.quotation.findFirst({
    where: { leadId, isSelected: true },
    select: { route: true, flightDateTime: true, itinerary: true, fromAirportCode: true, toAirportCode: true },
  });
  const sectors = parseStoredItinerary(quotation?.itinerary);
  const first = sectors[0];
  const [routeFrom, routeTo] = (quotation?.route ?? "").split(/→|-/).map((part) => airportCode(part.trim()));
  return {
    passengerNames,
    pnr,
    from: first ? airportCode(first.from) : (quotation?.fromAirportCode ?? routeFrom ?? null),
    // The first sector's arrival: for a connecting flight the ticket's first segment ends at the connection.
    to: first ? airportCode(first.to) : (quotation?.toAirportCode ?? routeTo ?? null),
    departureDate: first ? isoDay(first.departAt) : quotation?.flightDateTime ? quotation.flightDateTime.toISOString().slice(0, 10) : null,
  };
}

/**
 * Reads the uploaded ticket with the OCR provider and compares it. `checked: false` when it can't be read (no OCR
 * key — the SAMPLE placeholder — or the provider failed): the upload is then not blocked, nothing being known.
 */
export async function checkTicketUpload(fileBase64: string, expected: TicketExpected): Promise<{ checked: boolean; mismatches: TicketMismatch[] }> {
  try {
    const data = fileBase64.includes(",") ? fileBase64.slice(fileBase64.indexOf(",") + 1) : fileBase64;
    const mimeType = sniffMimeType(Buffer.from(data, "base64"));
    if (!mimeType) return { checked: false, mismatches: [] };
    const provider = getOcrProvider();
    const result = await provider.extractTicket({ fileBase64: data, mimeType });
    if (/placeholder/i.test(result.provider)) return { checked: false, mismatches: [] };
    return { checked: true, mismatches: compareTicket(result.fields, expected) };
  } catch (error) {
    console.error("[ticket-check] OCR failed", error instanceof Error ? error.message : "unknown");
    return { checked: false, mismatches: [] };
  }
}
