import Anthropic from "@anthropic-ai/sdk";
import { isPlaceholder } from "../env-placeholder";
import { DEFAULT_GEMINI_OCR_MODEL } from "../ocr/gemini-ocr-provider";

/**
 * One prompted text completion (system + user → text), shared by every text
 * AI feature: the Admin AI Command Center, the WhatsApp bot (intent + FAQ),
 * Ask-AI FAQ answers and message drafting. Client decision 2026-10-06: the
 * Gemini key they bought is used for all of these ("all in one"), so Gemini
 * is preferred when GEMINI_API_KEY is set; Claude (ANTHROPIC_API_KEY) is the
 * second choice; with neither, callers use their keyword/template fallback.
 */
export interface TextCompleter {
  readonly providerName: string;
  complete(system: string, userMessage: string, maxTokens: number): Promise<string>;
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CLAUDE_MODEL = "claude-sonnet-5";
const REQUEST_TIMEOUT_MS = 30_000;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  error?: { status?: string };
}

class GeminiTextCompleter implements TextCompleter {
  readonly providerName: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.providerName = `gemini (${model})`;
  }

  async complete(system: string, userMessage: string, maxTokens: number): Promise<string> {
    const response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.2,
          // Reasoning tokens count against the output budget, so leave room on top of the answer itself.
          maxOutputTokens: maxTokens + 2048,
          ...(this.model.startsWith("gemini-3")
            ? { thinkingConfig: { thinkingLevel: "low" } }
            : this.model.startsWith("gemini-2.5")
              ? { thinkingConfig: { thinkingBudget: 512 } }
              : {}),
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok || json.error) throw new Error(`Gemini request failed (${response.status}${json.error?.status ? ` ${json.error.status}` : ""})`);
    return (json.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
  }
}

class ClaudeTextCompleter implements TextCompleter {
  readonly providerName = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(system: string, userMessage: string, maxTokens: number): Promise<string> {
    const response = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  }
}

let cached: TextCompleter | null | undefined;

/** Gemini when GEMINI_API_KEY is set (model GEMINI_TEXT_MODEL, default the OCR model), else Claude, else null. */
export function getTextCompleter(): TextCompleter | null {
  if (cached !== undefined) return cached;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!isPlaceholder(geminiKey)) {
    const model = isPlaceholder(process.env.GEMINI_TEXT_MODEL) ? DEFAULT_GEMINI_OCR_MODEL : process.env.GEMINI_TEXT_MODEL!.trim();
    cached = new GeminiTextCompleter(geminiKey!, model);
  } else if (!isPlaceholder(anthropicKey)) {
    cached = new ClaudeTextCompleter(anthropicKey!);
  } else {
    cached = null;
  }
  return cached;
}
