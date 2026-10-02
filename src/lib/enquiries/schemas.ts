import { z } from "zod";
import { EnquiryCategory, EnquiryStatus, ServiceType } from "../../generated/prisma/enums";

const categoryValues = Object.values(EnquiryCategory) as [EnquiryCategory, ...EnquiryCategory[]];
const statusValues = Object.values(EnquiryStatus) as [EnquiryStatus, ...EnquiryStatus[]];
/** A lead can only be created for a real service, never "Other". */
const leadServiceValues = (Object.values(ServiceType) as ServiceType[]).filter((value) => value !== "OTHER") as [ServiceType, ...ServiceType[]];

export const enquiryListQuerySchema = z.object({
  category: z.enum(categoryValues).optional(),
  /** "open" = NEW + IN_PROGRESS. */
  status: z.union([z.enum(statusValues), z.literal("open")]).optional(),
  /** "complaints" = only complaints; "enquiries" = everything else. */
  view: z.enum(["complaints", "enquiries"]).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/** CRM edit. CONVERTED is never set here (only by Convert to Lead). */
export const enquiryUpdateSchema = z
  .object({
    category: z.enum(categoryValues).optional(),
    status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
    assignedStaffId: z.string().min(1).nullable().optional(),
    resolutionNote: z
      .string()
      .trim()
      .max(2000, "Too long")
      .transform((value) => (value === "" ? null : value))
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const enquiryNoteSchema = z.object({ note: z.string().trim().min(2, "Write a note").max(2000, "Too long") });

export const enquiryConvertSchema = z.object({
  serviceType: z.enum(leadServiceValues, { error: "Choose the service for the lead" }),
});

export const leadServiceTypeSchema = z.object({
  serviceType: z.enum(leadServiceValues, { error: "Choose a service" }),
});
