import type { LoginValues, RegisterValues } from "@/lib/validation/auth-schema";

export interface AuthResult {
  success: true;
}

/**
 * Frontend-only mocks — Auth.js + real sessions are M2 work (see CLAUDE.md
 * Milestones). These simulate the network round trip so the form's
 * loading/success states have something real to drive them; they never
 * persist a session or redirect as if signed in.
 */
export async function loginUser(values: LoginValues): Promise<AuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  void values;
  return { success: true };
}

export async function registerUser(values: RegisterValues): Promise<AuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  void values;
  return { success: true };
}
