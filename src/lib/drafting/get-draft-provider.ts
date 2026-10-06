import type { DraftProvider } from "./draft-provider";
import { LlmDraftProvider } from "./llm-draft-provider";
import { TemplateDraftProvider } from "./template-draft-provider";
import { getTextCompleter } from "@/lib/ai/text-completion";

let cached: DraftProvider | null = null;

/** Same swappable-service pattern as getAiProvider/getPaymentGateway/getEmailSender — uses the shared text model (Gemini or Claude). */
export function getDraftProvider(): DraftProvider {
  if (cached) return cached;

  const model = getTextCompleter();
  cached = model ? new LlmDraftProvider(model) : new TemplateDraftProvider();
  return cached;
}
