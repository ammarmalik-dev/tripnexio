import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitVisaExtensionRequest(values: VisaExtensionRequestValues): Promise<{ referenceId: string }> {
  const result = await postJson<CreateLeadResult>("/api/leads/visa-extension", values);
  return { referenceId: result.referenceId };
}
