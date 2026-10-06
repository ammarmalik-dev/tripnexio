import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType } from "../../generated/prisma/enums";

// Restricts `code` to a real ServiceType value — this is a metadata layer
// over the 6 locked services, not a way to invent a meaningless 7th one
// with no actual request flow/schema/route behind it. See Step 6's scoping
// note in DEVELOPMENT_ROADMAP.md.
const serviceTypeValues = Object.values(ServiceType) as [string, ...string[]];

export const createServiceSchema = z.object({
  code: z.enum(serviceTypeValues, { error: "Select a service type" }),
  name: z.string().trim().min(2, "Enter a service name").max(80, "Name is too long"),
  shortDescription: z.string().trim().min(2, "Enter a short description").max(300, "Description is too long"),
  ctaLabel: z.string().trim().max(40, "Button text is too long").default(""),
  /** Client corrections 2026-10-05 — this service's SAC code on invoices; blank = the Invoice Settings default. */
  sacCode: z
    .string()
    .trim()
    .max(12, "SAC code is too long")
    .regex(/^[0-9A-Za-z]*$/, "Use digits/letters only")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  /** The two letters inside every reference, e.g. "VI" in 10626VI001 (Locked Business Rules v2.0 §4). */
  referenceCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use exactly two letters, e.g. VI")
    .transform((value) => value.toUpperCase()),
  iconName: z.string().min(1, "Select an icon"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateServiceSchema = partialUpdateSchema(createServiceSchema);

export type CreateServiceValues = z.infer<typeof createServiceSchema>;
export type UpdateServiceValues = z.infer<typeof updateServiceSchema>;
