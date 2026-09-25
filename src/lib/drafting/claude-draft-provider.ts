import Anthropic from "@anthropic-ai/sdk";
import type { DraftProvider, DraftRequest, DraftResult } from "./draft-provider";
import { DRAFT_TYPE_PURPOSE } from "./draft-types";

/** Reuses the model already chosen for the WhatsApp bot's AI provider and OCR — this project's own instructions say to default to the latest, most capable Claude model for AI features. */
const MODEL = "claude-sonnet-5";

function buildSystemPrompt(request: DraftRequest): string {
  const { draftType, channel, instructions } = request;
  const channelRule =
    channel === "EMAIL"
      ? "Write a professional email. Also write a short, clear subject line."
      : "Write a short, concise WhatsApp message. There is no subject line — respond with subject as null.";

  return [
    `You are drafting a message on behalf of TripNexio, a travel/visa services company for India-to-UAE/GCC customers, to send to one specific customer.`,
    `Purpose of this message: ${DRAFT_TYPE_PURPOSE[draftType]}`,
    channelRule,
    `Rules (do not break these):`,
    `- Use ONLY the record data given below — never invent names, amounts, dates, statuses, reference numbers, or any other specific detail not present in it.`,
    `- If a detail relevant to this message is missing from the record data, do not guess it — write a short bracketed placeholder instead, e.g. "[confirm travel date]", so staff know to fill it in before sending.`,
    `- Keep the tone warm, professional, and concise.`,
    instructions ? `- Additional instruction from the staff member: ${instructions}` : "",
    `Respond with ONLY a JSON object, no other text: {"subject": <string or null>, "body": "<string>"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Real implementation, selected by getDraftProvider() once ANTHROPIC_API_KEY
 * is a real (non-placeholder) value. Same plain-prompted-completion pattern
 * as ClaudeAiProvider (whatsapp-bot) and ClaudeOcrProvider — no tool-calling
 * needed here either.
 */
export class ClaudeDraftProvider implements DraftProvider {
  readonly providerName = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async draft(request: DraftRequest): Promise<DraftResult> {
    const system = buildSystemPrompt(request);
    const userMessage = request.existingBody
      ? `The staff member has already started writing this message — revise, improve, or correct it while keeping their intent and following the rules above:\n"""\n${request.existingBody}\n"""\n\nRECORD DATA:\n${request.recordContext}`
      : `RECORD DATA:\n${request.recordContext}`;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("The AI draft didn't come back in the expected format.");
    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string | null; body?: string };
    if (!parsed.body) throw new Error("The AI draft didn't come back in the expected format.");

    return { subject: request.channel === "EMAIL" ? (parsed.subject ?? null) : null, body: parsed.body };
  }
}
