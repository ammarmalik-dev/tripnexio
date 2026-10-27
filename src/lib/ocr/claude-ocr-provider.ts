import Anthropic from "@anthropic-ai/sdk";
import type { OcrProvider, ExtractDocumentInput } from "./provider";
import type { PassportOcrFields, PassportOcrResult, TicketOcrFields, TicketOcrResult, VisaOcrFields, VisaOcrResult } from "./types";
import {
  OCR_PDF_TYPE,
  PASSPORT_SYSTEM_PROMPT,
  PASSPORT_USER_PROMPT,
  TICKET_SYSTEM_PROMPT,
  TICKET_USER_PROMPT,
  VISA_SYSTEM_PROMPT,
  VISA_USER_PROMPT,
  assertOcrMimeType,
  extractOcrFields,
  PASSPORT_FIELD_KEYS,
  TICKET_FIELD_KEYS,
  VISA_FIELD_KEYS,
} from "./ocr-prompts";

/** Reuses the model already chosen for the WhatsApp bot's AI provider — see src/lib/ai/text-completion.ts. */
const MODEL = "claude-sonnet-5";

type AllowedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function buildDocumentContentBlock(input: ExtractDocumentInput): Anthropic.Messages.ImageBlockParam | Anthropic.Messages.DocumentBlockParam {
  assertOcrMimeType(input.mimeType);
  if (input.mimeType === OCR_PDF_TYPE) {
    return { type: "document", source: { type: "base64", media_type: OCR_PDF_TYPE, data: input.fileBase64 } };
  }
  return { type: "image", source: { type: "base64", media_type: input.mimeType as AllowedImageType, data: input.fileBase64 } };
}

/**
 * Claude vision implementation, selected by getOcrProvider() when
 * ANTHROPIC_API_KEY is real and no Gemini key is configured (see
 * get-provider.ts). The visual reading (this file) is deliberately kept
 * separate from the deterministic MRZ checksum validation (mrz-parser.ts) —
 * this class's only job is "what does the document show," never "is that
 * internally consistent." Accepts images and PDFs (a `document` block).
 */
export class ClaudeOcrProvider implements OcrProvider {
  readonly providerName = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async read(input: ExtractDocumentInput, system: string, instruction: string): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: [buildDocumentContentBlock(input), { type: "text", text: instruction }] }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  }

  async extractPassport(input: ExtractDocumentInput): Promise<PassportOcrResult> {
    const parsed = extractOcrFields<PassportOcrFields>(await this.read(input, PASSPORT_SYSTEM_PROMPT, PASSPORT_USER_PROMPT), PASSPORT_FIELD_KEYS);
    return { provider: this.providerName, mrzRaw: parsed.mrzRaw, fields: parsed.fields };
  }

  async extractTicket(input: ExtractDocumentInput): Promise<TicketOcrResult> {
    const parsed = extractOcrFields<TicketOcrFields>(await this.read(input, TICKET_SYSTEM_PROMPT, TICKET_USER_PROMPT), TICKET_FIELD_KEYS);
    return { provider: this.providerName, mrzRaw: null, fields: parsed.fields };
  }

  async extractVisa(input: ExtractDocumentInput): Promise<VisaOcrResult> {
    const parsed = extractOcrFields<VisaOcrFields>(await this.read(input, VISA_SYSTEM_PROMPT, VISA_USER_PROMPT), VISA_FIELD_KEYS);
    return { provider: this.providerName, mrzRaw: null, fields: parsed.fields };
  }
}
