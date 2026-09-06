import type { NextRequest } from "next/server";
import { staffLoginSchema } from "@/lib/validation/staff-login-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { authenticateStaff } from "@/lib/auth/staff";
import { createStaffSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`staff-login:${ip}`)) {
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

  const token = await createStaffSessionToken({
    sub: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
  });

  const response = jsonSuccess({ id: staff.id, name: staff.name, email: staff.email, role: staff.role });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
