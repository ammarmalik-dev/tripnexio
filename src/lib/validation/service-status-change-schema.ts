import { z } from "zod";

/** P08 — a staff Change Status request: the target per-service status (allowed next statuses only, checked server-side). */
export const serviceStatusChangeSchema = z.object({
  serviceStatusId: z.string().trim().min(1, "Select a status"),
  note: z.string().trim().min(1).max(500).optional(),
  /** Client doc 2026-10-15 (I9) — Admin (admin.full) moves to any status; `note` then holds the required reason. */
  override: z.boolean().optional(),
  /** Client doc 2026-10-20 — what the customer is told with this status (reason, next step, charges…). */
  inputs: z
    .object({
      reason: z.string().trim().max(500).optional(),
      nextStep: z.string().trim().max(300).optional(),
      authority: z.string().trim().max(120).optional(),
      dueDate: z.string().trim().max(60).optional(),
      cancellationCharges: z.string().trim().max(60).optional(),
      estimatedRefund: z.string().trim().max(60).optional(),
      cancellationQuoteExpiry: z.string().trim().max(60).optional(),
    })
    .optional(),
});
