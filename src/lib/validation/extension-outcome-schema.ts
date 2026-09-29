import { z } from "zod";

/**
 * Visa_Extension.md §17-19 — the immigration outcome staff record on an
 * extension booking. Extended continues to the extended-visa delivery;
 * Not Accepted and Rejected are the two terminal outcomes with different
 * refund treatment (src/lib/refunds/rules.ts).
 */
export const setExtensionOutcomeSchema = z.object({
  outcome: z.enum(["EXTENDED", "NOT_ACCEPTED", "REJECTED"], { error: "Select an outcome" }),
});

export type SetExtensionOutcomeValues = z.infer<typeof setExtensionOutcomeSchema>;
