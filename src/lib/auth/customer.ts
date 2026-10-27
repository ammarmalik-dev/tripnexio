import bcrypt from "bcryptjs";
import { db } from "../db";
import { issueCustomerOtp, maskEmailForDisplay, verifyCustomerOtp } from "./customer-otp";
import { findCustomerByMobile } from "../customers/find-by-mobile";

export interface CustomerAuthResult {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
}

/** Validates customer credentials. Returns null on any failure — never distinguishes "no such account" from "wrong password," same rule the staff login already follows. */
export async function authenticateCustomer(email: string, password: string): Promise<CustomerAuthResult | null> {
  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer || !customer.passwordHash) return null;

  const matches = await bcrypt.compare(password, customer.passwordHash);
  if (!matches) return null;

  return { id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile };
}

export type RegisterCustomerResult =
  | { ok: true; customer: CustomerAuthResult }
  | { ok: false; otpRequired: true; maskedEmail: string; error: string }
  | { ok: false; otpRequired?: false; error: string; field?: "email" | "mobile" | "otp" };

/**
 * Registration reuses the "match by mobile, else by email" customer-matching
 * convention every lead-intake route follows (findOrCreateCustomer in
 * src/lib/leads/create-lead.ts), so a guest's earlier requests attach to
 * their new account. Claiming such a password-less guest row requires
 * proof of ownership first: a one-time code is emailed to the email ALREADY
 * on that row, and the row is only updated after that code is verified.
 */
/** Emails the signup / guest-claim code; false when the email couldn't be sent (never throws). */
async function sendSignupCode(customerId: string, email: string, name: string): Promise<boolean> {
  try {
    await issueCustomerOtp(customerId, email, name);
    return true;
  } catch (error) {
    console.error("[auth/register] verification code email failed", error instanceof Error ? error.message : "error");
    return false;
  }
}

export async function registerCustomer(input: {
  fullName: string;
  mobile: string;
  email: string;
  password: string;
  otp?: string;
}): Promise<RegisterCustomerResult> {
  const existingByMobile = await findCustomerByMobile(db, input.mobile);
  const existingByEmail = await db.customer.findUnique({ where: { email: input.email } });

  if (existingByMobile && existingByEmail && existingByMobile.id !== existingByEmail.id) {
    return {
      ok: false,
      error: "That mobile number and email are already used by two different existing records. Please contact us for help linking your account.",
      field: "mobile",
    };
  }

  let target = existingByMobile ?? existingByEmail;
  if (target?.passwordHash) {
    return { ok: false, error: "An account with this mobile number or email already exists. Try logging in instead.", field: "email" };
  }

  // Client doc 2026-10-20 (L5) — every new account proves its email with the 6-digit code: a first-time
  // customer is saved as a password-less (guest) record and the code goes to the email they entered.
  if (!target) {
    try {
      target = await db.customer.create({ data: { name: input.fullName, mobile: input.mobile, email: input.email } });
    } catch {
      return { ok: false, error: "That mobile number or email is already in use.", field: "email" };
    }
    // Client doc 2026-10-27 (M1) — a code that couldn't be emailed is said plainly (the form can be sent again).
    if (!(await sendSignupCode(target.id, input.email, input.fullName))) {
      return { ok: false, error: "We couldn't email your verification code right now. Please try again in a minute.", field: "email" };
    }
    return {
      ok: false,
      otpRequired: true,
      maskedEmail: maskEmailForDisplay(input.email),
      error: "Enter the 6-digit code we just emailed to confirm your email address.",
    };
  }

  if (target) {
    if (!target.email) {
      return {
        ok: false,
        error: "We found an earlier request with these details but no email on file to verify it. Please contact us and we'll link your account.",
        field: "mobile",
      };
    }
    if (!input.otp) {
      if (!(await sendSignupCode(target.id, target.email, target.name))) {
        return { ok: false, error: "We couldn't email your verification code right now. Please try again in a minute.", field: "email" };
      }
      return {
        ok: false,
        otpRequired: true,
        maskedEmail: maskEmailForDisplay(target.email),
        error: "We found an earlier request with these details. Enter the 6-digit code we just emailed to confirm it's you.",
      };
    }
    const verification = await verifyCustomerOtp(target.id, input.otp);
    if (verification !== "OK") {
      const messages = {
        INVALID: "That code isn't right. Check the email and try again.",
        EXPIRED: "That code has expired. Submit the form again to get a new one.",
        TOO_MANY_ATTEMPTS: "Too many incorrect codes. Submit the form again to get a new one.",
      } as const;
      return { ok: false, error: messages[verification], field: "otp" };
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const customer = target
      ? await db.customer.update({
          where: { id: target.id },
          // Client doc 2026-10-15 (J7) — signing up again after deleting the account starts a fresh login.
          // The email kept is the one the code proved (a changed email is updated later from My Profile, with its own code).
          data: { name: input.fullName, mobile: input.mobile, email: target.email ?? input.email, passwordHash, accountDeletedAt: null },
        })
      : await db.customer.create({
          data: { name: input.fullName, mobile: input.mobile, email: input.email, passwordHash },
        });
    return { ok: true, customer: { id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile } };
  } catch {
    // Unique-constraint race (e.g. two concurrent registrations for the same mobile/email) — generic, safe message.
    return { ok: false, error: "That mobile number or email is already in use.", field: "email" };
  }
}
