import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type StaffLoginValues = z.infer<typeof staffLoginSchema>;
