/** Whatever a provider (or the MRZ parser) could read — every field optional since legibility varies per image/document. */
export interface PassportOcrFields {
  fullName?: string;
  givenNames?: string;
  surname?: string;
  passportNumber?: string;
  nationality?: string;
  /** ISO date string (YYYY-MM-DD). */
  dob?: string;
  sex?: string;
  /** ISO date string (YYYY-MM-DD). */
  expiryDate?: string;
  issuingCountry?: string;
}

/** CRM.md §17 (Step 16): fields extracted from an uploaded flight ticket. */
export interface TicketOcrFields {
  airline?: string;
  flightNumber?: string;
  pnr?: string;
  passengerName?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  /** ISO date string (YYYY-MM-DD). */
  departureDate?: string;
  /** 24h HH:MM. */
  departureTime?: string;
  /** ISO date string (YYYY-MM-DD). */
  arrivalDate?: string;
  /** 24h HH:MM. */
  arrivalTime?: string;
  ticketNumber?: string;
  baggageAllowance?: string;
}

/** CRM.md §18 (Step 16): fields extracted from an uploaded visa PDF. */
export interface VisaOcrFields {
  passengerName?: string;
  passportNumber?: string;
  visaNumber?: string;
  visaType?: string;
  /** ISO date string (YYYY-MM-DD). */
  issueDate?: string;
  /** ISO date string (YYYY-MM-DD). */
  expiryDate?: string;
  /** Free text as printed, e.g. "Multiple Entry, 90 days" — visas don't print validity in one clean structured field. */
  validity?: string;
}

/** One shape shared by every document type's OCR result. */
export interface OcrResult<TFields> {
  provider: string;
  fields: TFields;
  /** The raw two-line MRZ text as transcribed from the image, if the provider found and read one. Only ever populated for passports — no MRZ exists on a ticket or visa. */
  mrzRaw: string | null;
}

export type PassportOcrResult = OcrResult<PassportOcrFields>;
export type TicketOcrResult = OcrResult<TicketOcrFields>;
export type VisaOcrResult = OcrResult<VisaOcrFields>;
