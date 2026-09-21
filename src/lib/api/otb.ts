import type { OtbRequestValues } from "@/lib/validation/otb-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitOtbRequest(values: OtbRequestValues): Promise<{ referenceId: string; nextUrl?: string }> {
  const result = await postJson<CreateLeadResult & { payToken?: string }>("/api/leads/otb", values);
  return { referenceId: result.referenceId, nextUrl: result.payToken ? `/pay/${result.payToken}` : undefined };
}
