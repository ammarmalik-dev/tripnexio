import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson, RequestIneligibleOutcome } from "./client";

interface VisaExtensionIneligibleResponse {
  eligible: false;
  redirect: { service: "VISA_CHANGE" | "NEW_VISA"; href: string; label: string };
  message: string;
}

type VisaExtensionResponse = ({ eligible: true } & CreateLeadResult) | VisaExtensionIneligibleResponse;

export async function submitVisaExtensionRequest(values: VisaExtensionRequestValues): Promise<{ referenceId: string }> {
  const result = await postJson<VisaExtensionResponse>("/api/leads/visa-extension", values);

  if (!result.eligible) {
    throw new RequestIneligibleOutcome(
      "We couldn't find an eligible TripNexio visa",
      `${result.message} ${
        result.redirect.service === "VISA_CHANGE"
          ? "Since you're inside the UAE, our Visa Change service may help instead."
          : "Since you're outside the UAE, you can apply for a New Visa instead."
      }`,
      { label: `Go to ${result.redirect.label}`, href: result.redirect.href }
    );
  }

  return { referenceId: result.referenceId };
}
