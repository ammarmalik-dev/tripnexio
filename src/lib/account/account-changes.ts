import { z } from "zod";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { findCustomerByMobile } from "../customers/find-by-mobile";
import { createTask } from "../tasks/create-task";
import { issueCustomerOtp, maskEmailForDisplay, verifyCustomerOtp, type VerifyOtpResult } from "../auth/customer-otp";

/**
 * Client doc 2026-10-15 (J7) — after signing up, a customer can change their mobile or email and delete
 * their account (legal requirement). Every change is confirmed with a 6-digit code emailed to them:
 *   - a new email: the code goes to the NEW address (proves it's theirs);
 *   - a new mobile, or deleting the account: the code goes to their current email.
 * The value being changed to is part of the code's purpose, so a code can't be reused for another value.
 */

export const contactChangeSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("email"), value: z.string().trim().toLowerCase().email("Enter a valid email address").max(120) }),
  z.object({
    field: z.literal("mobile"),
    value: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  }),
]);
export type ContactChange = z.infer<typeof contactChangeSchema>;

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const ACCOUNT_DELETE_PURPOSE = "ACCOUNT_DELETE";
const changePurpose = (change: ContactChange) => `CHANGE_${change.field.toUpperCase()}:${change.value}`;

export const OTP_ERROR_MESSAGES: Record<Exclude<VerifyOtpResult, "OK">, string> = {
  INVALID: "That code isn't right. Check the email and try again.",
  EXPIRED: "That code has expired. Ask for a new one.",
  TOO_MANY_ATTEMPTS: "Too many incorrect codes. Ask for a new one.",
};

type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string; field?: string };

/** Sends the confirmation code for a new email / mobile. */
export async function requestContactChange(customerId: string, change: ContactChange): Promise<Result<{ maskedEmail: string }>> {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, email: true, mobile: true } });
  if (!customer) return { ok: false, status: 404, error: "Account not found." };

  if (change.field === "email") {
    if (customer.email?.toLowerCase() === change.value) return { ok: false, status: 400, error: "That's already your email.", field: "value" };
    const taken = await db.customer.findFirst({ where: { email: { equals: change.value, mode: "insensitive" }, id: { not: customerId } }, select: { id: true } });
    if (taken) return { ok: false, status: 409, error: "That email is already linked to another record. Please contact us to merge them.", field: "value" };
    await issueCustomerOtp(customerId, change.value, customer.name, changePurpose(change), "to confirm your new email address for your TripNexio account");
    return { ok: true, maskedEmail: maskEmailForDisplay(change.value) };
  }

  if (!customer.email) return { ok: false, status: 400, error: "Add an email to your account first, or contact us to change your mobile." };
  const existing = await findCustomerByMobile(db, change.value);
  if (existing?.id === customerId) return { ok: false, status: 400, error: "That's already your mobile number.", field: "value" };
  if (existing) return { ok: false, status: 409, error: "That mobile number is already linked to another record. Please contact us to merge them.", field: "value" };
  await issueCustomerOtp(customerId, customer.email, customer.name, changePurpose(change), "to confirm changing the mobile number on your TripNexio account");
  return { ok: true, maskedEmail: maskEmailForDisplay(customer.email) };
}

/** Checks the code and saves the new email / mobile (audited). */
export async function confirmContactChange(customerId: string, change: ContactChange, code: string): Promise<Result> {
  const verification = await verifyCustomerOtp(customerId, code, changePurpose(change));
  if (verification !== "OK") return { ok: false, status: 400, error: OTP_ERROR_MESSAGES[verification], field: "code" };
  const before = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { email: true, mobile: true } });
  try {
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: change.field === "email" ? { email: change.value } : { mobile: change.value } });
      await writeAudit(tx, {
        entityType: "Customer",
        entityId: customerId,
        action: change.field === "email" ? "EMAIL_CHANGED" : "MOBILE_CHANGED",
        note: `${change.field === "email" ? "Email" : "Mobile"} changed by the customer: ${change.field === "email" ? (before.email ?? "—") : before.mobile} -> ${change.value} (verified by emailed code)`,
      });
    });
  } catch {
    return { ok: false, status: 409, error: `That ${change.field} is already in use.`, field: "value" };
  }
  return { ok: true };
}

/** Sends the code that confirms deleting the account. */
export async function requestAccountDeletion(customerId: string): Promise<Result<{ maskedEmail: string }>> {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { name: true, email: true } });
  if (!customer?.email) return { ok: false, status: 400, error: "Please contact us to delete your account." };
  await issueCustomerOtp(customerId, customer.email, customer.name, ACCOUNT_DELETE_PURPOSE, "to confirm deleting your TripNexio account");
  return { ok: true, maskedEmail: maskEmailForDisplay(customer.email) };
}

/**
 * Deletes the customer's login: the password is removed, every session ends (getCustomerSession refuses a
 * deleted account) and Google sign-in no longer opens it. Booking, payment and invoice records are kept as
 * the law requires (tax / audit), and documents follow the normal retention purge; a staff task asks the
 * team to remove anything else not legally needed. Signing up again later starts a fresh login.
 */
export async function confirmAccountDeletion(customerId: string, code: string): Promise<Result> {
  const verification = await verifyCustomerOtp(customerId, code, ACCOUNT_DELETE_PURPOSE);
  if (verification !== "OK") return { ok: false, status: 400, error: OTP_ERROR_MESSAGES[verification], field: "code" };
  await db.$transaction(async (tx) => {
    const customer = await tx.customer.update({ where: { id: customerId }, data: { passwordHash: null, accountDeletedAt: new Date() } });
    await writeAudit(tx, {
      entityType: "Customer",
      entityId: customerId,
      action: "ACCOUNT_DELETED",
      note: "The customer deleted their account (verified by emailed code): login removed, records kept as legally required",
    });
    await createTask(tx, {
      type: "MANUAL_VERIFICATION",
      priority: "HIGH",
      title: `Account deleted: ${customer.name}`,
      reason: "The customer deleted their account. Remove any personal data not needed for legal / tax records (bookings, payments and invoices stay).",
      entityType: "Customer",
      entityId: customerId,
    });
  });
  return { ok: true };
}
