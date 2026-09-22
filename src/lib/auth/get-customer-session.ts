import { cookies } from "next/headers";
import { db } from "../db";
import { CUSTOMER_SESSION_COOKIE_NAME, verifyCustomerSessionToken } from "./customer-session";

export interface CustomerSession {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
}

/**
 * Authoritative customer-session check for Server Components and Route
 * Handlers — mirrors getStaffSession()'s shape. Re-confirms the Customer
 * row still exists rather than trusting the JWT claims alone (there's no
 * "active" flag on Customer the way staff Users have, so existing is the
 * whole check).
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyCustomerSessionToken(token);
  if (!payload) return null;

  const customer = await db.customer.findUnique({ where: { id: payload.sub } });
  if (!customer) return null;

  return { id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile };
}
