import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifyStaffSessionToken } from "@/lib/auth/session";

/**
 * Fast, Edge-compatible pre-check for the staff CRM (/crm/**) and Admin
 * (/admin/**) sections — both share the same staff session, Admin is just
 * gated by a stricter permission check (roles.manage/staff.manage/
 * admin.full) done authoritatively in src/app/admin/(authenticated)/
 * layout.tsx, since permissions require a DB lookup this Edge check can't
 * do. This proxy only verifies the session JWT's signature — no DB call
 * (Prisma's node-postgres adapter doesn't run in the Edge runtime). This is
 * a UX-level gate, redirecting signed-out visitors before the page even
 * starts rendering; the authoritative check (confirms the user still
 * exists and is active) is src/lib/auth/staff-session.ts's
 * getStaffSession(), used in both layouts and every CRM/Admin API route.
 *
 * Named `proxy` (not `middleware`) per Next.js 16's renamed convention —
 * see https://nextjs.org/docs/messages/middleware-to-proxy.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/crm/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyStaffSessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/crm/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/admin/:path*"],
};
