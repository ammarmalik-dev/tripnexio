import type { OtbRequestValues } from "@/lib/validation/otb-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitOtbRequest(values: OtbRequestValues): Promise<CreateLeadResult> {
  return postJson<CreateLeadResult>("/api/leads/otb", values);
}
