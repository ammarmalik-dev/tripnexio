import Anthropic from "@anthropic-ai/sdk";
import type { AdminCommandProvider, CommandClassification } from "./command-provider";
import { COMMAND_TYPES, COMMAND_TYPE_KEYS, type CommandTypeKey } from "./command-types";

/** Same model choice as every other AI feature in this project (see claude-ai-provider.ts, claude-ocr-provider.ts). */
const MODEL = "claude-sonnet-5";

function buildSystemPrompt(): string {
  const catalog = COMMAND_TYPE_KEYS.map((key) => `- ${key}: ${COMMAND_TYPES[key].description}`).join("\n");
  return `You are the intent classifier for TripNexio's Admin AI Command Center — a natural-language query tool for Admin staff of a travel/visa service platform.

Classify the Admin's question into EXACTLY ONE of these command types:
${catalog}

If the matched type needs a parameter (see its description), extract it from the question as plain text — e.g. a booking id, a customer name, a staff name, a service name. If no parameter is needed or none could be extracted, use null.

Respond with ONLY a JSON object, no other text: {"commandType": "<ONE_OF_THE_ABOVE>", "param": <string or null>, "confidence": <0 to 1>}`;
}

/**
 * Real implementation, selected by get-command-provider.ts once
 * ANTHROPIC_API_KEY is a real (non-placeholder) value — reuses the exact
 * same credential already wired up for the WhatsApp bot and OCR (Phase
 * 5C/5D's own precedent), not a second account the client would need.
 */
export class ClaudeCommandProvider implements AdminCommandProvider {
  readonly providerName = "claude";
  private readonly client: Anthropic;
  private readonly systemPrompt: string;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.systemPrompt = buildSystemPrompt();
  }

  async classifyCommand(question: string): Promise<CommandClassification> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 150,
        system: this.systemPrompt,
        messages: [{ role: "user", content: question }],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { commandType: "NOT_AVAILABLE", param: null, confidence: 0 };

      const parsed = JSON.parse(jsonMatch[0]) as { commandType?: string; param?: string | null; confidence?: number };
      const commandType: CommandTypeKey = parsed.commandType && (COMMAND_TYPE_KEYS as string[]).includes(parsed.commandType)
        ? (parsed.commandType as CommandTypeKey)
        : "NOT_AVAILABLE";
      const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
      return { commandType, param: parsed.param ?? null, confidence };
    } catch {
      return { commandType: "NOT_AVAILABLE", param: null, confidence: 0 };
    }
  }
}
