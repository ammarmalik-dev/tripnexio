import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createNewVisaCountryConfigSchema = z.object({
  countryId: z.string().min(1, "Select a country"),
  /** P10 — the product: stay duration + entry type (one row per country + combination). */
  /** Client corrections 2026-10-05 — any active Visa Stay Type (checked by the API). */
  stayDays: z.number({ error: "Select the stay duration" }).int().min(1, "Select the stay duration"),
  /** Optional Visa Validity Type master entry. */
  validityTypeId: z.string().min(1).nullable().optional(),
  entryKind: z.enum(["SINGLE", "MULTIPLE"], { error: "Select Single or Multiple entry" }),
  displayOrder: z.number().int().default(0),
  visaCategory: z.string().trim().min(1, "Enter the visa category").max(120, "Visa category is too long"),
  /** Display text; derived from stayDays / entryKind when left empty. */
  duration: z.string().trim().max(60, "Duration is too long").optional(),
  entryType: z.string().trim().max(60, "Entry type is too long").optional(),
  processingType: z.string().trim().min(1, "Enter the processing type").max(120, "Processing type is too long"),
  description: z.string().trim().min(1, "Enter a description").max(2000, "Description is too long"),
  termsAndConditions: z.string().trim().min(1, "Enter terms and conditions").max(4000, "Terms and conditions is too long"),
  active: z.boolean().default(true),
});

export const updateNewVisaCountryConfigSchema = partialUpdateSchema(createNewVisaCountryConfigSchema);

export type CreateNewVisaCountryConfigValues = z.infer<typeof createNewVisaCountryConfigSchema>;
export type UpdateNewVisaCountryConfigValues = z.infer<typeof updateNewVisaCountryConfigSchema>;
