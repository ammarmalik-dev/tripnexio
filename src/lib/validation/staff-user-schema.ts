import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];
/** Step 39 — empty (the default) = unrestricted. See User.allowedServiceTypes' own schema doc comment. */
const allowedServiceTypesField = z.array(z.enum(serviceTypeValues)).optional();

/** Admin user-management schemas — distinct from the CRM's lightweight lead-assignment lookup (GET /api/staff). */
export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80, "Name is too long"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().min(1, "Select a role"),
  allowedServiceTypes: allowedServiceTypesField,
});

export const updateStaffUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80, "Name is too long").optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  allowedServiceTypes: allowedServiceTypesField,
});

export type CreateStaffUserValues = z.infer<typeof createStaffUserSchema>;
export type UpdateStaffUserValues = z.infer<typeof updateStaffUserSchema>;
