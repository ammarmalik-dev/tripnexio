import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitNewVisaRequest(values: NewVisaRequestValues): Promise<CreateLeadResult> {
  return postJson<CreateLeadResult>("/api/leads/new-visa", values);
}
