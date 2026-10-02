import type { OcrProvider, ExtractDocumentInput } from "./provider";
import type { PassportOcrFields, PassportOcrResult, TicketOcrFields, TicketOcrResult, VisaOcrFields, VisaOcrResult } from "./types";
import {
  PASSPORT_SYSTEM_PROMPT,
  PASSPORT_USER_PROMPT,
  TICKET_SYSTEM_PROMPT,
  TICKET_USER_PROMPT,
  VISA_SYSTEM_PROMPT,
  VISA_USER_PROMPT,
  assertOcrMimeType,
  parseOcrJson,
} from "./ocr-prompts";

/** The client's choice (Gemini 3 Flash). Override with GEMINI_OCR_MODEL, e.g. "gemini-2.5-flash" if a preview model is retired. */
export const DEFAULT_GEMINI_OCR_MODEL = "gemini-3-flash-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Transcribing printed text needs little reasoning, and on long reasoning
 * runs Gemini can spend the whole output budget before answering. Gemini 3
 * takes a thinking level; 2.5 takes a token budget. Other models: defaults.
 */
function thinkingConfigFor(model: string): { thinkingConfig?: { thinkingLevel: "low" } | { thinkingBudget: number } } {
  if (model.startsWith("gemini-3")) return { thinkingConfig: { thinkingLevel: "low" } };
  if (model.startsWith("gemini-2.5")) return { thinkingConfig: { thinkingBudget: 1024 } };
  return {};
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
}

/**
 * Google Gemini vision implementation (raw REST — no SDK needed for one
 * endpoint), selected by getOcrProvider() when GEMINI_API_KEY is set. Same
 * prompts and JSON shape as the Claude provider (ocr-prompts.ts), so nothing
 * downstream changes; the MRZ it reads is still checked by mrz-parser.ts.
 * Images and PDFs are sent inline (base64); uploads are capped at 8MB, well
 * under Gemini's inline request limit.
 */
export class GeminiOcrProvider implements OcrProvider {
  readonly providerName: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_GEMINI_OCR_MODEL
  ) {
    this.providerName = `gemini (${model})`;
  }

  private async read(input: ExtractDocumentInput, system: string, instruction: string): Promise<string> {
    assertOcrMimeType(input.mimeType);
    const response = await fetch(`${API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: input.mimeType, data: input.fileBase64 } }, { text: instruction }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          // Room for the model's own reasoning tokens on top of the small JSON answer.
          maxOutputTokens: 8192,
          ...thinkingConfigFor(this.model),
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const json = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok || json.error) {
      // Never include the request (it carries the document) or the key in the error.
      throw new Error(`Gemini OCR request failed (${response.status}${json.error?.status ? ` ${json.error.status}` : ""})`);
    }
    if (json.promptFeedback?.blockReason) {
      throw new Error(`Gemini declined the document (${json.promptFeedback.blockReason})`);
    }
    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
    // An empty answer (e.g. the reasoning used up the token budget) is a
    // failure staff should see and retry, not a silently blank extraction.
    if (!text) throw new Error(`Gemini returned no answer (finish reason: ${candidate?.finishReason ?? "none"})`);
    return text;
  }

  async extractPassport(input: ExtractDocumentInput): Promise<PassportOcrResult> {
    const parsed = parseOcrJson<PassportOcrFields>(await this.read(input, PASSPORT_SYSTEM_PROMPT, PASSPORT_USER_PROMPT));
    return { provider: this.providerName, mrzRaw: parsed.mrzRaw ?? null, fields: parsed.fields ?? {} };
  }

  async extractTicket(input: ExtractDocumentInput): Promise<TicketOcrResult> {
    const parsed = parseOcrJson<TicketOcrFields>(await this.read(input, TICKET_SYSTEM_PROMPT, TICKET_USER_PROMPT));
    return { provider: this.providerName, mrzRaw: null, fields: parsed.fields ?? {} };
  }

  async extractVisa(input: ExtractDocumentInput): Promise<VisaOcrResult> {
    const parsed = parseOcrJson<VisaOcrFields>(await this.read(input, VISA_SYSTEM_PROMPT, VISA_USER_PROMPT));
    return { provider: this.providerName, mrzRaw: null, fields: parsed.fields ?? {} };
  }
}
