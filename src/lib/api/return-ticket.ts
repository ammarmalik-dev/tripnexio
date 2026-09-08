import type { ReturnTicketRequestValues } from "@/lib/validation/return-ticket-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitReturnTicketRequest(values: ReturnTicketRequestValues): Promise<CreateLeadResult> {
  return postJson<CreateLeadResult>("/api/leads/return-ticket", values);
}
