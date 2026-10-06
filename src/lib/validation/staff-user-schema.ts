import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];
/** Step 39 — empty (the default) = unrestricted. See User.allowedServiceTypes' own schema doc comment. */
const allowedServiceTypesField = z.array(z.enum(serviceTypeValues)).optional();
/**
 * P24 item 6 — Country ids this staff member handles; empty (the default) =
 * every country. The API de-duplicates and checks every id is a real Country.
 */
const countriesHandledField = z.array(z.string().trim().min(1).max(40)).max(300, "Too many countries").optional();

/** Admin user-management schemas — distinct from the CRM's lightweight lead-assignment lookup (GET /api/staff). */
/** Client corrections 2026-10-05 — staff profile details from the Create Staff form. */
const mobileField = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid mobile number");
const officialIdField = z.string().trim().max(40, "Official ID is too long");
const personalDetailsField = z.string().trim().max(1000, "Keep personal details under 1000 characters");

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80, "Name is too long"),
  /** Official email — the login, and where the credentials are sent. */
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  /** Optional: when omitted, a temporary password is generated and emailed with the login details. */
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  roleId: z.string().min(1, "Select a role"),
  mobile: mobileField,
  officialId: officialIdField.optional(),
  personalDetails: personalDetailsField.optional(),
  allowedServiceTypes: allowedServiceTypesField,
  countriesHandled: countriesHandledField,
});

export const updateStaffUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80, "Name is too long").optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  mobile: mobileField.optional(),
  officialId: officialIdField.optional(),
  personalDetails: personalDetailsField.optional(),
  allowedServiceTypes: allowedServiceTypesField,
  countriesHandled: countriesHandledField,
});

export type CreateStaffUserValues = z.infer<typeof createStaffUserSchema>;
export type UpdateStaffUserValues = z.infer<typeof updateStaffUserSchema>;
