/** Whatever a provider (or the MRZ parser) could read — every field optional since legibility varies per image. */
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

export interface PassportOcrResult {
  provider: string;
  fields: PassportOcrFields;
  /** The raw MRZ lines as transcribed from the image, if the provider found and read one — fed into the deterministic parser (mrz-parser.ts) for checksum validation. */
  mrzRaw: string | null;
}
