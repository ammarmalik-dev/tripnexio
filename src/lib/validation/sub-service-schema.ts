import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType } from "../../generated/prisma/enums";

export const serviceTypeSchema = z.enum(Object.values(ServiceType) as [ServiceType, ...ServiceType[]], {
  error: "Select a service",
});

/** Machine code stored on leads/pricing — lower-case, snake_case. */
export const masterCodeSchema = z
  .string()
  .trim()
  .min(1, "Enter a code")
  .max(40, "Code is too long")
  .transform((value) => value.toLowerCase().replace(/\s+/g, "_"))
  .refine((value) => /^[a-z0-9_-]+$/.test(value), "Use letters, numbers, - or _ only");

const optionalDescription = z
  .string()
  .trim()
  .max(300, "Description is too long")
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const createSubServiceSchema = z.object({
  serviceType: serviceTypeSchema,
  code: masterCodeSchema,
  name: z.string().trim().min(2, "Enter a name").max(80, "Name is too long"),
  description: optionalDescription,
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateSubServiceSchema = partialUpdateSchema(createSubServiceSchema);

export const createProcessingTypeSchema = z.object({
  serviceType: serviceTypeSchema,
  code: masterCodeSchema,
  label: z.string().trim().min(2, "Enter a label").max(60, "Label is too long"),
  description: optionalDescription,
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

/**
 * `code` (and the service it belongs to) is fixed after creation — it's the
 * value stored on existing leads and pricing rules, so renaming it would
 * orphan them. Change the `label` instead.
 */
export const updateProcessingTypeSchema = partialUpdateSchema(createProcessingTypeSchema.omit({ code: true, serviceType: true }));
