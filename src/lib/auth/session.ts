import { SignJWT, jwtVerify } from "jose";

/**
 * Staff CRM session — a signed JWT in an httpOnly cookie, verified with
 * `jose` (Edge-runtime compatible, unlike Prisma/pg) so src/middleware.ts
 * can check it without a database round trip. The authoritative check
 * (confirms the user still exists and is active) lives in
 * src/lib/auth/staff-session.ts and runs in Server Components/Route
 * Handlers, which do have DB access.
 *
 * This is scoped to staff-only auth for the CRM (Phase 3). Customer-facing
 * auth (Auth.js, Google OAuth, guest browsing) is separate, later work —
 * see CLAUDE.md's Auth section and Milestones.
 */

export const SESSION_COOKIE_NAME = "tnx_staff_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export interface StaffSessionPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

function getSecretKey() {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret) {
    throw new Error("STAFF_SESSION_SECRET is not set — see .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function createStaffSessionToken(payload: StaffSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyStaffSessionToken(token: string): Promise<StaffSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return { sub: payload.sub, email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}
