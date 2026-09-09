import type { PassportOcrResult, TicketOcrResult, VisaOcrResult } from "./types";

export interface ExtractDocumentInput {
  /** Base64 file bytes — an image (JPEG/PNG/GIF/WebP) or a PDF. */
  fileBase64: string;
  mimeType: string;
}

/**
 * Swappable OCR layer, same shape as every other external-service
 * integration in this app. One method per document type (Step 16 extended
 * this from passport-only to also cover Ticket and Visa documents, CRM.md
 * §17/§18) — deliberately kept as separate methods rather than one generic
 * `extract(type, input)`, so each keeps its own typed result shape and its
 * own dedicated prompt/parsing logic, matching "the exact same architecture
 * as the passport OCR" per the roadmap prompt. The deterministic,
 * checksum-validating MRZ parsing itself lives in mrz-parser.ts, not here —
 * a future provider swap only has to implement "read the document."
 */
export interface OcrProvider {
  readonly providerName: string;
  extractPassport(input: ExtractDocumentInput): Promise<PassportOcrResult>;
  extractTicket(input: ExtractDocumentInput): Promise<TicketOcrResult>;
  extractVisa(input: ExtractDocumentInput): Promise<VisaOcrResult>;
}
