import { SignJWT, jwtVerify } from "jose";

/**
 * Customer-facing session — same shape as the staff session (src/lib/auth/
 * session.ts), just a separate cookie/secret/TTL, since these are two
 * genuinely different audiences (see CLAUDE.md's Auth section: "staff/CRM
 * auth is a separate, already-implemented system... does not use Auth.js").
 * Longer TTL than staff (30 days vs. 8 hours) since a customer isn't
 * expected to re-authenticate every session the way staff handling
 * sensitive operations are.
 */

export const CUSTOMER_SESSION_COOKIE_NAME = "tnx_customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface CustomerSessionPayload {
  sub: string;
  email: string | null;
  name: string;
}

function getSecretKey() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) {
    throw new Error("CUSTOMER_SESSION_SECRET is not set — see .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function createCustomerSessionToken(payload: CustomerSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${CUSTOMER_SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyCustomerSessionToken(token: string): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
    if (payload.email !== null && typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: (payload.email as string | null) ?? null, name: payload.name };
  } catch {
    return null;
  }
}
