import { z } from "zod";

/** P08 — a staff Change Status request: the target per-service status (allowed next statuses only, checked server-side). */
export const serviceStatusChangeSchema = z.object({
  serviceStatusId: z.string().trim().min(1, "Select a status"),
  note: z.string().trim().min(1).max(500).optional(),
});
