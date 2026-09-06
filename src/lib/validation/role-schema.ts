import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(60, "Role name is too long"),
  permissionNames: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(60, "Role name is too long").optional(),
  permissionNames: z.array(z.string()).optional(),
});

export type CreateRoleValues = z.infer<typeof createRoleSchema>;
export type UpdateRoleValues = z.infer<typeof updateRoleSchema>;
