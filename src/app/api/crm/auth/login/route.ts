import type { NextRequest } from "next/server";
import { staffLoginSchema } from "@/lib/validation/staff-login-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { authenticateStaff } from "@/lib/auth/staff";
import { createStaffSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { canAccessAdminSection } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await isRateLimited(`staff-login:${ip}`)) {
    return jsonError(429, "Too many login attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = staffLoginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const staff = await authenticateStaff(parsed.data.email, parsed.data.password);
  if (!staff) {
    // Deliberately generic — never reveal whether the email exists.
    return jsonError(401, "Invalid email or password.");
  }
  // Client testing 2026-10-09 (F11) — Administrative Login is for Admin accounts only (no session otherwise).
  const adminAccess = canAccessAdminSection(staff);
  if (parsed.data.loginType === "admin" && !adminAccess) {
    return jsonError(403, "You are not authorised for Administrative Login. Please use Team Login.");
  }

  const token = await createStaffSessionToken({
    sub: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    sessionVersion: staff.sessionVersion,
  });

  // adminAccess only picks where the login screen lands; /admin still checks permissions on every request.
  const response = jsonSuccess({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    adminAccess,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
