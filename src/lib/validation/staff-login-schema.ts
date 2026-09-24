import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type StaffLoginValues = z.infer<typeof staffLoginSchema>;

export const STAFF_LOGIN_TYPES = ["admin", "team_member"] as const;
export type StaffLoginType = (typeof STAFF_LOGIN_TYPES)[number];

/**
 * Step 48 — the Admin/Team Member selector is purely presentational (see
 * this form's own doc comment): there's no separate credential or backend
 * distinction, both hit the exact same POST /api/crm/auth/login. This
 * extended schema exists only so the selector can use react-hook-form's
 * typed `register()` (RadioCardGroup wants a `Path<T>`) — `loginType` is
 * stripped before the request body is sent, never validated server-side.
 */
export const staffLoginFormSchema = staffLoginSchema.extend({
  loginType: z.enum(STAFF_LOGIN_TYPES),
});

export type StaffLoginFormValues = z.infer<typeof staffLoginFormSchema>;
