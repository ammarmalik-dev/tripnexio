import bcrypt from "bcryptjs";
import { db } from "../db";

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
  | { ok: false; error: string; field?: "email" | "mobile" };

/**
 * Registration reuses the exact same "match by mobile, else by email"
 * customer-matching convention every lead-intake route already follows
 * (see findOrCreateCustomer in src/lib/leads/create-lead.ts) — a guest who
 * submitted a request before ever creating an account gets their existing
 * history (leads/bookings) attached automatically the moment they register
 * with the same mobile or email, instead of ending up with two disconnected
 * Customer rows.
 */
export async function registerCustomer(input: {
  fullName: string;
  mobile: string;
  email: string;
  password: string;
}): Promise<RegisterCustomerResult> {
  const existingByMobile = await db.customer.findUnique({ where: { mobile: input.mobile } });
  const existingByEmail = await db.customer.findUnique({ where: { email: input.email } });

  if (existingByMobile && existingByEmail && existingByMobile.id !== existingByEmail.id) {
    return {
      ok: false,
      error: "That mobile number and email are already used by two different existing records. Please contact us for help linking your account.",
      field: "mobile",
    };
  }

  const target = existingByMobile ?? existingByEmail;
  if (target?.passwordHash) {
    return { ok: false, error: "An account with this mobile number or email already exists. Try logging in instead.", field: "email" };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const customer = target
      ? await db.customer.update({
          where: { id: target.id },
          data: { name: input.fullName, mobile: input.mobile, email: input.email, passwordHash },
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
