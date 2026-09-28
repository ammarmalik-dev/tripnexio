import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifyStaffSessionToken } from "@/lib/auth/session";

/**
 * Two jobs, both Edge-compatible (no DB access):
 *
 * 1. /api/** — cross-site request forgery guard. A state-changing request
 *    (anything but GET/HEAD/OPTIONS) whose Origin is a different host, or
 *    whose browser marks it Sec-Fetch-Site: cross-site, is rejected before
 *    it reaches a route. Cookie-authenticated routes (staff and customer
 *    sessions) are what this protects; server-to-server callers
 *    (gateway/WhatsApp webhooks, the n8n automation endpoints) send no
 *    browser Origin and authenticate by signature/shared key, so they're
 *    exempt.
 *
 * 2. /crm/** and /admin/** — a fast pre-check that verifies the staff
 *    session JWT's signature and redirects signed-out visitors to the login
 *    page. The authoritative check (user still active, session version,
 *    permissions) is getStaffSession() in the layouts and every API route.
 *
 * Named `proxy` (not `middleware`) per Next.js 16's renamed convention.
 */
const PUBLIC_CRM_PATHS = ["/crm/login", "/crm/forgot-password", "/crm/reset-password"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ORIGIN_CHECK_EXEMPT = ["/api/webhooks/", "/api/automation/"];

function isCrossSite(request: NextRequest): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host !== host;
    } catch {
      return true;
    }
  }
  return request.headers.get("sec-fetch-site") === "cross-site";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!SAFE_METHODS.has(request.method) && !ORIGIN_CHECK_EXEMPT.some((prefix) => pathname.startsWith(prefix)) && isCrossSite(request)) {
      return NextResponse.json({ error: { message: "Cross-site request blocked." } }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Forgot/reset-password must be reachable by a signed-out visitor, same as /crm/login.
  if (PUBLIC_CRM_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyStaffSessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/crm/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/admin/:path*", "/api/:path*"],
};
