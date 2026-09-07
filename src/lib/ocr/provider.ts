import type { PassportOcrResult } from "./types";

export interface ExtractPassportInput {
  imageBase64: string;
  mimeType: string;
}

/**
 * Swappable OCR layer, same shape as every other external-service
 * integration in this app. Deliberately just ONE job (read a passport
 * image, report whatever text/MRZ it found) — the deterministic,
 * checksum-validating MRZ parsing itself lives in mrz-parser.ts, not here,
 * so a future provider swap (e.g. a dedicated document-OCR vendor) only
 * has to implement "read the image," not re-derive MRZ math.
 */
export interface OcrProvider {
  readonly providerName: string;
  extractPassport(input: ExtractPassportInput): Promise<PassportOcrResult>;
}
