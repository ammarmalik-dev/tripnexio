import type { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation/auth-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { authenticateCustomer } from "@/lib/auth/customer";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE_NAME, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/customer-session";
import { isRateLimited } from "@/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`customer-login:${ip}`)) {
    return jsonError(429, "Too many login attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const customer = await authenticateCustomer(parsed.data.email, parsed.data.password);
  if (!customer) {
    // Deliberately generic — never reveal whether the email exists.
    return jsonError(401, "Invalid email or password.");
  }

  const token = await createCustomerSessionToken({ sub: customer.id, email: customer.email, name: customer.name });

  const response = jsonSuccess({ id: customer.id, name: customer.name, email: customer.email });
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_SECONDS,
  });
  return response;
}
