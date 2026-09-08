import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitVisaChangeRequest(values: VisaChangeRequestValues): Promise<CreateLeadResult> {
  return postJson<CreateLeadResult>("/api/leads/visa-change", values);
}
