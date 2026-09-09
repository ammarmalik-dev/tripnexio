import type { OcrProvider, ExtractDocumentInput } from "./provider";
import type { PassportOcrResult, TicketOcrResult, VisaOcrResult } from "./types";

/**
 * Selected automatically by getOcrProvider() when ANTHROPIC_API_KEY is
 * unset/still a placeholder — lets the rest of the pipeline (upload ->
 * provider -> [MRZ checksum validation for passports] -> DocumentExtraction
 * row -> review UI -> confirm-and-apply) be exercised end-to-end without a
 * real key, same role as MockPaymentGateway/ConsoleEmailSender/
 * KeywordAiProvider.
 *
 * Unlike those, this CANNOT plausibly simulate reading the actual uploaded
 * document (there's no non-ML way to "mock" optical character recognition)
 * — so every method always returns the same canned, clearly-labeled SAMPLE
 * data regardless of what was uploaded. The passport sample is the
 * fictional ICAO Doc 9303 specimen (ERIKSSON, ANNA MARIA / Utopia) — a
 * real, checksum-valid MRZ, so mrz-parser.ts's validation genuinely runs
 * and genuinely passes. The ticket/visa samples are equally fictional and
 * obviously placeholder (SAMPLE airline/flight/visa numbers, matching this
 * project's hard rule against inventing real domain data even as a demo).
 * The `providerName` and every caller's UI must make it unmistakable this
 * wasn't read from the customer's own document.
 */
export class PlaceholderOcrProvider implements OcrProvider {
  readonly providerName = "placeholder (no ANTHROPIC_API_KEY configured — SAMPLE data, not read from the uploaded document)";

  async extractPassport(_input: ExtractDocumentInput): Promise<PassportOcrResult> {
    return {
      provider: this.providerName,
      mrzRaw: "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10",
      fields: {},
    };
  }

  async extractTicket(_input: ExtractDocumentInput): Promise<TicketOcrResult> {
    return {
      provider: this.providerName,
      mrzRaw: null,
      fields: {
        airline: "SAMPLE Airlines",
        flightNumber: "SA101",
        pnr: "SAMPLE1",
        passengerName: "SAMPLE PASSENGER",
        departureAirport: "SAMPLE Departure Airport",
        arrivalAirport: "SAMPLE Arrival Airport",
        departureDate: "2026-01-01",
        departureTime: "10:00",
        arrivalDate: "2026-01-01",
        arrivalTime: "14:00",
        ticketNumber: "SAMPLE-TICKET-0001",
        baggageAllowance: "SAMPLE 20kg",
      },
    };
  }

  async extractVisa(_input: ExtractDocumentInput): Promise<VisaOcrResult> {
    return {
      provider: this.providerName,
      mrzRaw: null,
      fields: {
        passengerName: "SAMPLE PASSENGER",
        passportNumber: "SAMPLE0000001",
        visaNumber: "SAMPLE-VISA-0001",
        visaType: "SAMPLE Tourist",
        issueDate: "2026-01-01",
        expiryDate: "2026-04-01",
        validity: "SAMPLE Multiple Entry, 90 days",
      },
    };
  }
}
