import type { OutputType } from "./output-types";
import { db } from "../db";
import { parseStoredItinerary } from "../quotations/itinerary";

/**
 * Client doc 2026-10-14 — the text in the body of the "ticket issued" email
 * (Special Fare, Domestic and International) and the "return ticket issued"
 * email, word for word. Other outputs keep the general discrepancy note.
 */
export const OUTPUT_IMPORTANT_INFO: Partial<Record<OutputType, { title: string; lines: string[]; closing: string }>> = {
  TICKET_PDF: {
    title: "Important Information",
    lines: [
      "Airport Reporting: Arrive at least 2 hours before domestic flights and 4 hours before international flights.",
      "Travel Documents: Carry a valid government-issued photo ID for domestic travel. International travellers must carry a valid passport, applicable visas and transit documents.",
      "Terminal & Timings: Confirm the departure terminal and latest flight status with the airline. All timings are local to the respective airports.",
      "Web Check-in: Complete airline web check-in and obtain your boarding pass where required.",
      "Baggage: Check the baggage allowance mentioned on your ticket.",
      "Changes & Refunds: Cancellations, refunds and rescheduling are subject to airline fare rules and applicable charges.",
      "Travel Requirements: Passengers are responsible for meeting visa, transit, immigration and OTB requirements, where applicable.",
      "Ticket Verification Disclaimer: Please check all ticket details, including passenger names, travel dates, flight timings and routes, immediately upon receipt. Report any errors to TripNexio within 12 hours of ticket issuance. Later corrections will be subject to airline rules, availability and applicable charges.",
    ],
    closing: "Have a safe and pleasant journey with TripNexio!",
  },
  RESERVATION_PDF: {
    title: "⚠️ Important: Please Verify Your Details",
    lines: [
      "Kindly check your name, travel dates, route, and all reservation details carefully. If you notice any errors, inform us within 4 hours of receiving this message. After this period require a new ticket at an additional cost.",
      "Disclaimer:",
      "A return ticket or reservation does not guarantee boarding, visa approval, immigration clearance, or entry into any country.",
      "Final decisions regarding boarding and entry rest with the airline and relevant immigration authorities.",
      "Please ensure you meet all visa, passport, and travel requirements before departure.",
      "We recommend verifying all details promptly to avoid last-minute issues.",
    ],
    closing: "Have a safe and pleasant journey with TripNexio!",
  },
};

function when(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

/**
 * Client doc 2026-10-14 — the issued ticket's facts in the message: PNR,
 * passengers with ticket numbers, airline, flight(s) and baggage (the PDF is
 * the Download button). Empty for any other output.
 */
export async function ticketDetailsFor(bookingId: string, outputType: OutputType): Promise<string> {
  if (outputType !== "TICKET_PDF") return "";
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        pnr: true,
        ticketBaggage: true,
        passengers: { select: { ticketNumber: true, passenger: { select: { fullName: true } } } },
        lead: { select: { quotations: { where: { isSelected: true }, take: 1 } } },
      },
    });
    if (!booking) return "";
    const quote = booking.lead.quotations[0];
    const airlineCode = quote?.airline ?? null;
    const airline = airlineCode ? await db.airline.findUnique({ where: { code: airlineCode }, select: { name: true } }) : null;
    const lines: string[] = [];
    if (booking.pnr) lines.push(`PNR: ${booking.pnr}`);
    for (const row of booking.passengers) lines.push(`Passenger: ${row.passenger.fullName}${row.ticketNumber ? ` · Ticket ${row.ticketNumber}` : ""}`);
    if (airline?.name || airlineCode) lines.push(`Airline: ${airline?.name ?? airlineCode}`);
    const sectors = parseStoredItinerary(quote?.itinerary);
    if (sectors.length > 0) {
      for (const sector of sectors) {
        const times = [when(sector.departAt), when(sector.arriveAt)].filter(Boolean).join(" → ");
        lines.push(`Flight: ${[sector.flightNumber, `${sector.from} → ${sector.to}`, times].filter(Boolean).join(" · ")}`);
      }
    } else if (quote?.route) {
      const times = [when(quote.flightDateTime), when(quote.arrivalDateTime)].filter(Boolean).join(" → ");
      lines.push(`Flight: ${[quote.flightNumber, quote.route, times].filter(Boolean).join(" · ")}`);
    }
    const baggage = booking.ticketBaggage || quote?.baggageAllowance;
    if (baggage) lines.push(`Baggage: ${baggage}`);
    return lines.join("\n");
  } catch {
    return "";
  }
}
