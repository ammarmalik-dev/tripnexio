import Anthropic from "@anthropic-ai/sdk";
import type { OcrProvider, ExtractDocumentInput } from "./provider";
import type { PassportOcrFields, PassportOcrResult, TicketOcrFields, TicketOcrResult, VisaOcrFields, VisaOcrResult } from "./types";

/** Reuses the model already chosen for the WhatsApp bot's AI provider — see src/lib/whatsapp-bot/claude-ai-provider.ts. */
const MODEL = "claude-sonnet-5";

type AllowedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const PDF_TYPE = "application/pdf";

const PASSPORT_SYSTEM_PROMPT = `You are transcribing a passport's photo/bio-data page for a travel agency's records. Two tasks, in order of priority:

1. Find the Machine Readable Zone (MRZ) — the block of two lines of monospaced text at the bottom of the page, made of capital letters, digits, and "<" filler characters, exactly 44 characters per line. Transcribe those two lines EXACTLY as printed, character for character, including every "<". Do not correct, guess, or "fix" anything — if a character is genuinely unreadable, use "<" as the safest default rather than guessing a letter. If there is no visible MRZ (e.g. the image doesn't show the bio page, or it's cropped out), leave this null — do not invent one.

2. Also read the human-readable printed fields on the page as a fallback (full name, passport number, nationality, date of birth, sex, passport expiry date, issuing country) — best-effort, it's fine to leave a field out if it isn't clearly legible.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "mrzRaw": "<the two MRZ lines joined by a newline, or null>",
  "fields": {
    "fullName": "<string or omit>",
    "passportNumber": "<string or omit>",
    "nationality": "<string or omit>",
    "dob": "<YYYY-MM-DD or omit>",
    "sex": "<M or F or omit>",
    "expiryDate": "<YYYY-MM-DD or omit>",
    "issuingCountry": "<string or omit>"
  }
}`;

const TICKET_SYSTEM_PROMPT = `You are transcribing a flight ticket/e-ticket/boarding pass for a travel agency's records (CRM.md §17). Read whatever is clearly legible — it's fine to omit a field rather than guess.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "fields": {
    "airline": "<string or omit>",
    "flightNumber": "<string or omit>",
    "pnr": "<string or omit>",
    "passengerName": "<string or omit>",
    "departureAirport": "<string or omit>",
    "arrivalAirport": "<string or omit>",
    "departureDate": "<YYYY-MM-DD or omit>",
    "departureTime": "<24h HH:MM or omit>",
    "arrivalDate": "<YYYY-MM-DD or omit>",
    "arrivalTime": "<24h HH:MM or omit>",
    "ticketNumber": "<string or omit>",
    "baggageAllowance": "<string or omit>"
  }
}`;

const VISA_SYSTEM_PROMPT = `You are transcribing a visa document/PDF for a travel agency's records (CRM.md §18). Read whatever is clearly legible — it's fine to omit a field rather than guess.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "fields": {
    "passengerName": "<string or omit>",
    "passportNumber": "<string or omit>",
    "visaNumber": "<string or omit>",
    "visaType": "<string or omit>",
    "issueDate": "<YYYY-MM-DD or omit>",
    "expiryDate": "<YYYY-MM-DD or omit>",
    "validity": "<validity as printed, e.g. 'Multiple Entry, 90 days', or omit>"
  }
}`;

function buildDocumentContentBlock(input: ExtractDocumentInput): Anthropic.Messages.ImageBlockParam | Anthropic.Messages.DocumentBlockParam {
  if (input.mimeType === PDF_TYPE) {
    return { type: "document", source: { type: "base64", media_type: PDF_TYPE, data: input.fileBase64 } };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(input.mimeType)) {
    throw new Error(`Unsupported file type "${input.mimeType}" — use JPEG, PNG, GIF, WebP, or PDF.`);
  }
  return { type: "image", source: { type: "base64", media_type: input.mimeType as AllowedImageType, data: input.fileBase64 } };
}

function parseJsonResponse<T extends object>(raw: string): { mrzRaw?: string | null; fields?: T } {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return {};
  }
}

/**
 * Real implementation, selected by getOcrProvider() once ANTHROPIC_API_KEY
 * is a real (non-placeholder) value — reuses the SAME credential/SDK
 * already wired for the WhatsApp bot's AI provider (Phase 5C), since it's
 * genuinely the same vendor/key, not a separate "OCR vendor" account the
 * client would need to set up. The visual reading (this file) is
 * deliberately kept separate from the deterministic MRZ checksum
 * validation (mrz-parser.ts) — this class's only job is "what does the
 * document show," never "is that internally consistent."
 *
 * Step 16 extended this from image-only (passport photos) to also accept
 * PDFs (Claude's Messages API supports PDF input directly as a `document`
 * content block, distinct from an `image` block) — tickets and especially
 * visa documents are commonly issued as PDFs, per CRM.md §17/§18's own
 * "Ticket document"/"Visa PDF" wording.
 */
export class ClaudeOcrProvider implements OcrProvider {
  readonly providerName = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractPassport(input: ExtractDocumentInput): Promise<PassportOcrResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: PASSPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [buildDocumentContentBlock(input), { type: "text", text: "Transcribe this passport's MRZ and readable fields per the instructions." }],
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    const parsed = parseJsonResponse<PassportOcrFields>(raw);
    return { provider: this.providerName, mrzRaw: parsed.mrzRaw ?? null, fields: parsed.fields ?? {} };
  }

  async extractTicket(input: ExtractDocumentInput): Promise<TicketOcrResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: TICKET_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [buildDocumentContentBlock(input), { type: "text", text: "Transcribe this flight ticket's readable fields per the instructions." }],
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    const parsed = parseJsonResponse<TicketOcrFields>(raw);
    return { provider: this.providerName, mrzRaw: null, fields: parsed.fields ?? {} };
  }

  async extractVisa(input: ExtractDocumentInput): Promise<VisaOcrResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: VISA_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [buildDocumentContentBlock(input), { type: "text", text: "Transcribe this visa document's readable fields per the instructions." }],
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    const parsed = parseJsonResponse<VisaOcrFields>(raw);
    return { provider: this.providerName, mrzRaw: null, fields: parsed.fields ?? {} };
  }
}
