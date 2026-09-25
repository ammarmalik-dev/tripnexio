import type { DraftProvider, DraftRequest, DraftResult } from "./draft-provider";
import { DRAFT_TYPE_LABELS, DRAFT_TYPE_OPENER } from "./draft-types";

/**
 * Dev fallback, selected by getDraftProvider() until ANTHROPIC_API_KEY is
 * configured — same "genuinely useful, not just a stub" convention as
 * whatsapp-bot's KeywordAiProvider: it can't compose freely, but it builds
 * a real, honest message straight from the same record-data lines the real
 * provider would have been given, so it never invents anything either.
 */
export class TemplateDraftProvider implements DraftProvider {
  readonly providerName = "template";

  async draft(request: DraftRequest): Promise<DraftResult> {
    const lines = request.recordContext.split("\n").filter(Boolean);
    const nameLine = lines.find((line) => line.startsWith("Customer name:"));
    const firstName = nameLine ? nameLine.replace("Customer name:", "").trim().split(" ")[0] : "there";
    const referenceLine = lines.find((line) => line.startsWith("Lead reference:"));
    const reference = referenceLine ? referenceLine.replace("Lead reference:", "").trim() : null;
    const factLines = lines.filter((line) => !line.startsWith("Customer name:"));

    const parts = [
      `Hi ${firstName},`,
      "",
      DRAFT_TYPE_OPENER[request.draftType],
      factLines.length > 0 ? factLines.map((line) => `- ${line}`).join("\n") : "",
      "",
      request.channel === "EMAIL" ? "Please let us know if you have any questions.\n\nWarm regards,\nTripNexio Team" : "Let us know if you have any questions!",
    ].filter((part) => part !== "");

    const body = parts.join("\n\n");
    const subject = request.channel === "EMAIL" ? `${DRAFT_TYPE_LABELS[request.draftType]}${reference ? ` — ${reference}` : ""}` : null;

    return { subject, body };
  }
}
