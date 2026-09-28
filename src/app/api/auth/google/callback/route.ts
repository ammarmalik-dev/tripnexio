import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, isGoogleSignInConfigured, safeNextPath, verifiedGoogleIdentity } from "@/lib/auth/google";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE_NAME, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/customer-session";
import { createStaffSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { siteConfig } from "@/lib/site-config";
import { describeError } from "@/lib/api/describe-error";

const stateSchema = z.object({ state: z.string().regex(/^[a-f0-9]{32}$/), target: z.enum(["customer", "staff"]), next: z.string() });

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

function redirectTo(path: string) {
  const response = NextResponse.redirect(new URL(path, siteConfig.url));
  response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  return response;
}

/**
 * P09 — Google Sign-In callback. Verifies the state cookie (CSRF) and
 * Google's ID token, then signs in:
 *   - a customer whose account already uses that email (otherwise sends them
 *     to register with the email pre-filled — Google never creates accounts);
 *   - a staff member only if an ACTIVE User has that exact email.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleSignInConfigured()) return NextResponse.json({ error: { message: "Not found." } }, { status: 404 });

  const params = new URL(request.url).searchParams;
  let stored: z.infer<typeof stateSchema> | null = null;
  try {
    stored = stateSchema.parse(JSON.parse(request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? ""));
  } catch {
    stored = null;
  }
  const code = params.get("code");
  if (!stored || !code || params.get("state") !== stored.state) {
    return redirectTo("/login?google=failed");
  }
  const failurePath = stored.target === "staff" ? "/crm/login?google=failed" : "/login?google=failed";

  let identity: { email: string; name: string } | null = null;
  try {
    identity = await verifiedGoogleIdentity(code);
  } catch (error) {
    console.error("[api/auth/google/callback] token verification failed", describeError(error));
  }
  if (!identity) return redirectTo(failurePath);

  if (stored.target === "staff") {
    const user = await db.user.findFirst({
      where: { email: { equals: identity.email, mode: "insensitive" }, active: true },
      include: { role: true },
    });
    if (!user) return redirectTo("/crm/login?google=no-account");
    const token = await createStaffSessionToken({ sub: user.id, email: user.email, name: user.name, role: user.role.name, sessionVersion: user.sessionVersion });
    await writeAudit(db, { entityType: "User", entityId: user.id, action: "LOGIN_GOOGLE", note: "Signed in with Google" });
    const response = redirectTo(safeNextPath(stored.next, "/crm"));
    response.cookies.set(SESSION_COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
    return response;
  }

  const customer = await db.customer.findFirst({ where: { email: { equals: identity.email, mode: "insensitive" } } });
  if (!customer) {
    const register = new URLSearchParams({ email: identity.email, name: identity.name, google: "new" });
    return redirectTo(`/register?${register.toString()}`);
  }
  const token = await createCustomerSessionToken({ sub: customer.id, email: customer.email, name: customer.name });
  await writeAudit(db, { entityType: "Customer", entityId: customer.id, action: "LOGIN_GOOGLE", note: "Signed in with Google" });
  const response = redirectTo(safeNextPath(stored.next, "/account"));
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, token, { ...cookieOptions, maxAge: CUSTOMER_SESSION_TTL_SECONDS });
  return response;
}
