import { z } from "zod";
import { LeadStatus, type LeadStatus as LeadStatusType } from "../../generated/prisma/enums";

const leadStatusValues = Object.values(LeadStatus) as [LeadStatusType, ...LeadStatusType[]];

export const updateLeadStatusSchema = z.object({
  status: z.enum(leadStatusValues, { error: "Select a valid lead status" }),
  note: z.string().trim().min(1).optional(),
});

export type UpdateLeadStatusValues = z.infer<typeof updateLeadStatusSchema>;
