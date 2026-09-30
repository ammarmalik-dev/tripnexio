import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { serviceTypeSchema } from "./sub-service-schema";

/** Empty string / null / undefined all mean "not set" for an optional id reference. */
const optionalId = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

/**
 * P24 — Admin → Assignment Rules. A rule narrows who auto-assign may pick
 * for a service (optionally one sub-service): only staff on `roleId` (when
 * set) with fewer than `maxOpenLeads` open leads (when set). Higher
 * `priority` is tried first. See src/lib/staff/auto-assign.ts.
 */
export const createAssignmentRuleSchema = z.object({
  serviceType: serviceTypeSchema,
  subServiceId: optionalId,
  roleId: optionalId,
  maxOpenLeads: z
    .number({ error: "Enter a whole number" })
    .int("Enter a whole number")
    .min(1, "Must be at least 1")
    .max(10000, "Too large")
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  priority: z.number({ error: "Enter a whole number" }).int("Enter a whole number").min(-1000).max(1000).default(0),
  active: z.boolean().default(true),
});

export const updateAssignmentRuleSchema = partialUpdateSchema(createAssignmentRuleSchema);

export type CreateAssignmentRuleValues = z.infer<typeof createAssignmentRuleSchema>;
