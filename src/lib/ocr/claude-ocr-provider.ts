import Anthropic from "@anthropic-ai/sdk";
import type { OcrProvider, ExtractPassportInput } from "./provider";
import type { PassportOcrFields, PassportOcrResult } from "./types";

/** Reuses the model already chosen for the WhatsApp bot's AI provider — see src/lib/whatsapp-bot/claude-ai-provider.ts. */
const MODEL = "claude-sonnet-5";

type AllowedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ALLOWED_MEDIA_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const SYSTEM_PROMPT = `You are transcribing a passport's photo/bio-data page for a travel agency's records. Two tasks, in order of priority:

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

/**
 * Real implementation, selected by getOcrProvider() once ANTHROPIC_API_KEY
 * is a real (non-placeholder) value — reuses the SAME credential/SDK
 * already wired for the WhatsApp bot's AI provider (Phase 5C), since it's
 * genuinely the same vendor/key, not a separate "OCR vendor" account the
 * client would need to set up. The visual reading (this file) is
 * deliberately kept separate from the deterministic MRZ checksum
 * validation (mrz-parser.ts) — this class's only job is "what does the
 * image show," never "is that internally consistent."
 */
export class ClaudeOcrProvider implements OcrProvider {
  readonly providerName = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractPassport(input: ExtractPassportInput): Promise<PassportOcrResult> {
    if (!ALLOWED_MEDIA_TYPES.includes(input.mimeType)) {
      throw new Error(`Unsupported image type "${input.mimeType}" — use JPEG, PNG, GIF, or WebP.`);
    }

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mimeType as AllowedMediaType, data: input.imageBase64 } },
            { type: "text", text: "Transcribe this passport's MRZ and readable fields per the instructions." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    let parsed: { mrzRaw?: string | null; fields?: PassportOcrFields };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    return {
      provider: this.providerName,
      mrzRaw: parsed.mrzRaw ?? null,
      fields: parsed.fields ?? {},
    };
  }
}
