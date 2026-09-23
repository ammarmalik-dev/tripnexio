import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { LeaveType, type LeaveType as LeaveTypeT, type LeaveStatus as LeaveStatusT } from "../../generated/prisma/enums";

const leaveTypeValues = Object.values(LeaveType) as [LeaveTypeT, ...LeaveTypeT[]];

const staffLeaveBaseSchema = z.object({
  userId: z.string().min(1, "Select a staff member"),
  type: z.enum(leaveTypeValues, { error: "Select a leave type" }),
  startDate: z.string().min(1, "Select a start date"),
  endDate: z.string().min(1, "Select an end date"),
  reason: z.string().trim().max(200, "Reason is too long").optional(),
});

function crossFieldChecks(value: { startDate: string; endDate: string }, ctx: z.RefinementCtx) {
  if (new Date(value.endDate) < new Date(value.startDate)) {
    ctx.addIssue({ code: "custom", message: "End date must be on or after the start date", path: ["endDate"] });
  }
}

/** Admin creating a leave entry directly for any staff member (`userId` is theirs to pick). */
export const createStaffLeaveSchema = staffLeaveBaseSchema.superRefine(crossFieldChecks);
// A leave record's staff member isn't editable after creation — delete and
// re-add instead, same as every other masters screen treats an identity
// field (e.g. Coupon.code isn't relevant here, but the pattern matches).
export const updateStaffLeaveSchema = partialUpdateSchema(staffLeaveBaseSchema.omit({ userId: true }));

/** Step 38: staff requesting their own leave — no `userId` field at all, the server derives it from the session so a staff member can never submit someone else's request. */
export const createOwnStaffLeaveSchema = staffLeaveBaseSchema.omit({ userId: true }).superRefine(crossFieldChecks);

const leaveDecisionValues = ["APPROVED", "REJECTED"] as [LeaveStatusT, LeaveStatusT];
export const leaveDecisionSchema = z.object({
  status: z.enum(leaveDecisionValues, { error: "Select Approved or Rejected" }),
});

export type CreateStaffLeaveValues = z.infer<typeof createStaffLeaveSchema>;
export type UpdateStaffLeaveValues = z.infer<typeof updateStaffLeaveSchema>;
export type CreateOwnStaffLeaveValues = z.infer<typeof createOwnStaffLeaveSchema>;
export type LeaveDecisionValues = z.infer<typeof leaveDecisionSchema>;
