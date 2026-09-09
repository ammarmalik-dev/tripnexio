import { z } from "zod";

/** Visa_Extension.md §17-18 (Step 15) — the two distinct terminal outcomes the refund rule engine needs. */
export const setExtensionOutcomeSchema = z.object({
  outcome: z.enum(["NOT_ACCEPTED", "REJECTED"], { error: "Select an outcome" }),
});

export type SetExtensionOutcomeValues = z.infer<typeof setExtensionOutcomeSchema>;
