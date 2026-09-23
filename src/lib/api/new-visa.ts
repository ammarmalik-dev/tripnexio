import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitNewVisaRequest(values: NewVisaRequestValues): Promise<{ referenceId: string; nextUrl?: string }> {
  const result = await postJson<CreateLeadResult & { payToken?: string }>("/api/leads/new-visa", values);
  return { referenceId: result.referenceId, nextUrl: result.payToken ? `/pay/${result.payToken}` : undefined };
}
