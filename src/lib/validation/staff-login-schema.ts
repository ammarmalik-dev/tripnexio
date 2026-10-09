import { z } from "zod";

export const STAFF_LOGIN_TYPES = ["admin", "team_member"] as const;
export type StaffLoginType = (typeof STAFF_LOGIN_TYPES)[number];

/**
 * Client testing 2026-10-09 (F11) — the login type is sent to the server:
 * "admin" signs in only an account with Admin access; anyone else gets
 * "not authorised" and no session (they use Team Login). Optional so older
 * clients default to Team Login.
 */
export const staffLoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  loginType: z.enum(STAFF_LOGIN_TYPES).optional(),
});

export type StaffLoginValues = z.infer<typeof staffLoginSchema>;

export const staffLoginFormSchema = staffLoginSchema.extend({
  loginType: z.enum(STAFF_LOGIN_TYPES),
});

export type StaffLoginFormValues = z.infer<typeof staffLoginFormSchema>;
