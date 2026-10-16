import { z } from "zod";

/** P08 — a staff Change Status request: the target per-service status (allowed next statuses only, checked server-side). */
export const serviceStatusChangeSchema = z.object({
  serviceStatusId: z.string().trim().min(1, "Select a status"),
  note: z.string().trim().min(1).max(500).optional(),
  /** Client doc 2026-10-15 (I9) — Admin (admin.full) moves to any status; `note` then holds the required reason. */
  override: z.boolean().optional(),
});
