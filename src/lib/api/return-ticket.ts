import type { ReturnTicketRequestValues } from "@/lib/validation/return-ticket-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitReturnTicketRequest(values: ReturnTicketRequestValues): Promise<{ referenceId: string; nextUrl?: string }> {
  const result = await postJson<CreateLeadResult & { payToken?: string }>("/api/leads/return-ticket", values);
  return { referenceId: result.referenceId, nextUrl: result.payToken ? `/pay/${result.payToken}` : undefined };
}
