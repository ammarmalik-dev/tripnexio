import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createNewVisaCountryConfigSchema = z.object({
  countryId: z.string().min(1, "Select a country"),
  visaCategory: z.string().trim().min(1, "Enter the visa category").max(120, "Visa category is too long"),
  duration: z.string().trim().min(1, "Enter the visa duration").max(60, "Duration is too long"),
  entryType: z.string().trim().min(1, "Enter the entry type").max(60, "Entry type is too long"),
  processingType: z.string().trim().min(1, "Enter the processing type").max(120, "Processing type is too long"),
  description: z.string().trim().min(1, "Enter a description").max(2000, "Description is too long"),
  termsAndConditions: z.string().trim().min(1, "Enter terms and conditions").max(4000, "Terms and conditions is too long"),
  active: z.boolean().default(true),
});

export const updateNewVisaCountryConfigSchema = partialUpdateSchema(createNewVisaCountryConfigSchema);

export type CreateNewVisaCountryConfigValues = z.infer<typeof createNewVisaCountryConfigSchema>;
export type UpdateNewVisaCountryConfigValues = z.infer<typeof updateNewVisaCountryConfigSchema>;
