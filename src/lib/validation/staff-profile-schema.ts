import { z } from "zod";

/**
 * P22 item 5 — CRM.md §31 Profile & Security. A small fixed list rather than
 * free text, so a question can't itself leak the answer and the list stays
 * consistent across staff.
 */
export const STAFF_SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "In which city were you born?",
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the make of your first car?",
  "What is the name of the street you grew up on?",
] as const;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(200, "Password is too long"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const securityQuestionSchema = z.object({
  question: z
    .string()
    .refine((value) => (STAFF_SECURITY_QUESTIONS as readonly string[]).includes(value), "Select a security question"),
  answer: z.string().trim().min(2, "Enter an answer (at least 2 characters)").max(200, "Keep the answer under 200 characters"),
  /**
   * Required to change security settings — same proof-of-possession as a
   * password change. Named `password` (not `currentPassword`) so its field id
   * doesn't collide with the Change Password form on the same Profile page.
   */
  password: z.string().min(1, "Enter your current password"),
});

export type SecurityQuestionValues = z.infer<typeof securityQuestionSchema>;

/** Case/whitespace-insensitive, so "  New  Delhi" matches "new delhi" at verification time. */
export function normalizeSecurityAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}
