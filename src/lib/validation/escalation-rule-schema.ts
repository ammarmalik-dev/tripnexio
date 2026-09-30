import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { serviceTypeSchema } from "./sub-service-schema";

/** Who an SLA escalation goes to: MANAGERS = staff.manage holders, ADMINS = admin.full holders. */
export const ESCALATE_TO_VALUES = ["MANAGERS", "ADMINS"] as const;
export type EscalateTo = (typeof ESCALATE_TO_VALUES)[number];

export const ESCALATE_TO_LABELS: Record<EscalateTo, string> = {
  MANAGERS: "Managers (staff.manage)",
  ADMINS: "Admins (admin.full)",
};

/** The permission whose holders receive an escalation for each target. */
export const ESCALATE_TO_PERMISSION: Record<EscalateTo, string> = {
  MANAGERS: "staff.manage",
  ADMINS: "admin.full",
};

/**
 * P24 — Admin → SLA Escalation. `serviceType` null = every service;
 * `serviceStatusId` null = any non-terminal status (a status requires its
 * service to be set — checked by the API against the status row itself).
 */
export const createEscalationRuleSchema = z.object({
  serviceType: serviceTypeSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  serviceStatusId: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  hoursInStatus: z
    .number({ error: "Enter a whole number of hours" })
    .int("Enter a whole number of hours")
    .min(1, "Must be at least 1 hour")
    .max(8760, "At most 8760 hours (one year)"),
  escalateTo: z.enum(ESCALATE_TO_VALUES, { error: "Choose who to escalate to" }),
  active: z.boolean().default(true),
});

export const updateEscalationRuleSchema = partialUpdateSchema(createEscalationRuleSchema);

export type CreateEscalationRuleValues = z.infer<typeof createEscalationRuleSchema>;
