import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson, RequestIneligibleOutcome } from "./client";

/** P13 — the exact no-match message (Visa Extension handover). */
export const NO_PRIOR_VISA_MESSAGE = "We currently provide visa extension services only for visas issued through TripNexio.";

export async function submitVisaExtensionRequest(values: VisaExtensionRequestValues): Promise<{ referenceId: string }> {
  const result = await postJson<CreateLeadResult & { priorVisaFound: boolean; unmatchedApplicants: string[] }>("/api/leads/visa-extension", values);
  if (!result.priorVisaFound) {
    // The request is saved for our team (flagged noPriorVisa); the customer is offered the right service instead.
    const partial = result.unmatchedApplicants.length < 1 + values.additionalApplicants.length;
    throw new RequestIneligibleOutcome(
      NO_PRIOR_VISA_MESSAGE,
      `${partial ? `We couldn't find a TripNexio visa for ${result.unmatchedApplicants.join(", ")}. ` : ""}Your request ${result.referenceId} is saved and our team will contact you. Where are you right now?`,
      { label: "I'm inside the UAE", href: "/services/visa-change" },
      { label: "I'm outside the UAE", href: "/services/new-visa" }
    );
  }
  return { referenceId: result.referenceId };
}
