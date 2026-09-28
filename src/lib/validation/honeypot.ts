import { z } from "zod";

/**
 * Hidden anti-bot field shared by the 6 public request forms. Real visitors
 * never see or fill it (MultiStepRequestFlow renders it off-screen); the
 * intake routes reject any submission where it is non-empty.
 */
export const HONEYPOT_FIELD = "website";

export const honeypotShape = {
  website: z.string().max(500).optional(),
};

export function isHoneypotFilled(value: string | undefined): boolean {
  return Boolean(value && value.trim() !== "");
}
