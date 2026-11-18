import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson, RequestIneligibleOutcome } from "./client";

/** P13 — the exact no-match message (Visa Extension handover). */
export const NO_PRIOR_VISA_MESSAGE = "We currently provide visa extension services only for visas issued through TripNexio.";

export async function submitVisaExtensionRequest(values: VisaExtensionRequestValues): Promise<{ referenceId: string; confirmationMessage?: string }> {
  const result = await postJson<CreateLeadResult & { priorVisaFound: boolean; unmatchedApplicants: string[] }>("/api/leads/visa-extension", values);
  const applicantCount = 1 + values.additionalApplicants.length;
  // Client doc 16 Nov (E1) — mixed travellers: when at least one passenger's visa was issued by TripNexio the request
  // goes ahead for them; the others are named so our team checks their visa copy. Only when NO passenger matches is
  // the customer offered Visa Change / New Visa instead.
  if (!result.priorVisaFound && result.unmatchedApplicants.length >= applicantCount) {
    // The request is saved for our team (flagged noPriorVisa); the customer is offered the right service instead.
    throw new RequestIneligibleOutcome(
      NO_PRIOR_VISA_MESSAGE,
      `Your request ${result.referenceId} is saved and our team will contact you. Where are you right now?`,
      { label: "I'm inside the UAE", href: "/services/visa-change" },
      { label: "I'm outside the UAE", href: "/services/new-visa" }
    );
  }
  const note =
    result.unmatchedApplicants.length > 0
      ? `\n\nWe couldn't find a TripNexio visa for ${result.unmatchedApplicants.join(", ")} — our team will review their visa copy and confirm whether their extension can be processed.`
      : "";
  return { referenceId: result.referenceId, confirmationMessage: result.confirmationMessage ? `${result.confirmationMessage}${note}` : note.trim() || undefined };
}
