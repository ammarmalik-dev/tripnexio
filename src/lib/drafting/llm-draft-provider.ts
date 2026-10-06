import type { TextCompleter } from "@/lib/ai/text-completion";
import type { DraftProvider, DraftRequest, DraftResult } from "./draft-provider";
import { DRAFT_TYPE_PURPOSE } from "./draft-types";

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

/** Real implementation over the shared text model (Gemini or Claude, see src/lib/ai/text-completion.ts), selected by getDraftProvider(). */
export class LlmDraftProvider implements DraftProvider {
  readonly providerName: string;

  constructor(private readonly model: TextCompleter) {
    this.providerName = model.providerName;
  }

  async draft(request: DraftRequest): Promise<DraftResult> {
    const system = buildSystemPrompt(request);
    const userMessage = request.existingBody
      ? `The staff member has already started writing this message — revise, improve, or correct it while keeping their intent and following the rules above:\n"""\n${request.existingBody}\n"""\n\nRECORD DATA:\n${request.recordContext}`
      : `RECORD DATA:\n${request.recordContext}`;

    const raw = await this.model.complete(system, userMessage, 600);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("The AI draft didn't come back in the expected format.");
    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string | null; body?: string };
    if (!parsed.body) throw new Error("The AI draft didn't come back in the expected format.");

    return { subject: request.channel === "EMAIL" ? (parsed.subject ?? null) : null, body: parsed.body };
  }
}
