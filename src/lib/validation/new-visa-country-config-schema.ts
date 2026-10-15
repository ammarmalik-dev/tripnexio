import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

/** Client doc 2026-10-15 — the New Visa product's Visa Category choices. */
export const NEW_VISA_CATEGORIES = ["Tourist", "Transit", "Business", "Arrival Card"] as const;

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
  /**
   * Client doc 2026-10-15 — no longer asked: the description lives on the country's New Visa
   * page, the terms in the country's Terms & Conditions, processing in the country timeline.
   * Older rows keep their stored text.
   */
  processingType: z.string().trim().max(120, "Processing type is too long").optional(),
  description: z.string().trim().max(2000, "Description is too long").optional(),
  termsAndConditions: z.string().trim().max(4000, "Terms and conditions is too long").optional(),
  active: z.boolean().default(true),
});

export const updateNewVisaCountryConfigSchema = partialUpdateSchema(createNewVisaCountryConfigSchema);

export type CreateNewVisaCountryConfigValues = z.infer<typeof createNewVisaCountryConfigSchema>;
export type UpdateNewVisaCountryConfigValues = z.infer<typeof updateNewVisaCountryConfigSchema>;
