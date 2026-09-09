import { z } from "zod";
import { LeadTemperature, type LeadTemperature as LeadTemperatureType } from "../../generated/prisma/enums";

const leadTemperatureValues = Object.values(LeadTemperature) as [LeadTemperatureType, ...LeadTemperatureType[]];

/** `temperature: null` clears the classification back to unset — staff can always undo a Hot/Warm/Cold call. */
export const updateLeadTemperatureSchema = z.object({
  temperature: z.enum(leadTemperatureValues).nullable(),
});

export type UpdateLeadTemperatureValues = z.infer<typeof updateLeadTemperatureSchema>;
