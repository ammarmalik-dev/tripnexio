import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

/** One ticked cell of the roster grid: this staff member covers this service on this weekday. */
export const rosterEntrySchema = z.object({
  userId: z.string().min(1),
  serviceType: z.enum(serviceTypeValues),
  /** JS weekday: 0 = Sunday ... 6 = Saturday. */
  dayOfWeek: z.number().int().min(0).max(6),
});

/**
 * P22 item 8 — PUT /api/admin/roster. Bulk replace:
 *  - `userId` set → only that staff member's roster is replaced by `entries`
 *    (every entry must then belong to that user);
 *  - `userId` omitted → the whole grid (every active staff member) is
 *    replaced by `entries`.
 * `entries` omitted = leave the roster untouched (e.g. only toggling
 * `autoAssignLeads`). At least one of the two must be sent.
 */
export const updateRosterSchema = z
  .object({
    userId: z.string().min(1).optional(),
    entries: z.array(rosterEntrySchema).max(5000, "Too many roster entries").optional(),
    autoAssignLeads: z.boolean().optional(),
  })
  .refine((value) => value.entries !== undefined || value.autoAssignLeads !== undefined, {
    message: "Nothing to update",
  })
  .refine((value) => !value.userId || !value.entries || value.entries.every((entry) => entry.userId === value.userId), {
    message: "Every entry must belong to the selected staff member",
    path: ["entries"],
  });

export type RosterEntry = z.infer<typeof rosterEntrySchema>;
export type UpdateRosterValues = z.infer<typeof updateRosterSchema>;
