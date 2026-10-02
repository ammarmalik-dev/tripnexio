import { z } from "zod";
import { partialUpdateSchema } from "../validation/partial-update";

/** URL-safe slug for /services/new-visa/<slug>. "request" is the apply form's own route. */
const RESERVED_SLUGS = new Set(["request"]);
export const COUNTRY_PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

const textList = z.array(z.string().trim().min(1).max(300)).max(20).default([]);

/** Admin form for one New Visa country page. Shared by the API routes and the Admin screen. */
export const createCountryPageSchema = z.object({
  countryId: z.string().min(1, "Choose a country"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "At least 2 characters")
    .max(60)
    .regex(COUNTRY_PAGE_SLUG_PATTERN, "Use lowercase letters, numbers and hyphens only (e.g. uae, saudi-arabia)")
    .refine((slug) => !RESERVED_SLUGS.has(slug), "This URL name is reserved"),
  published: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  cardTagline: optionalText(140),
  heroEyebrow: optionalText(60),
  heroTitle: z.string().trim().min(3, "Enter the page heading").max(120),
  heroSubtitle: z.string().trim().min(10, "Enter a short introduction").max(400),
  introHeading: optionalText(160),
  introBody: optionalText(3000),
  applicantsHeading: optionalText(160),
  applicantsBody: optionalText(1000),
  whatYouNeed: textList,
  documents: textList,
  documentsNote: optionalText(1000),
  childrenNote: optionalText(1000),
  validityText: optionalText(600),
  stayText: optionalText(600),
  beforeYouApply: textList,
  ctaHeading: optionalText(160),
  ctaBody: optionalText(600),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
});

/** PATCH: every field optional; the country a page belongs to never changes. */
export const updateCountryPageSchema = partialUpdateSchema(createCountryPageSchema.omit({ countryId: true }));

export type CreateCountryPageValues = z.infer<typeof createCountryPageSchema>;
export type UpdateCountryPageValues = z.infer<typeof updateCountryPageSchema>;

export const countryPageImageSchema = z.object({
  kind: z.enum(["card", "hero"]),
  /** Base64 file contents (no data: prefix). Images only, checked server-side by magic bytes. */
  data: z.string().min(1),
});
