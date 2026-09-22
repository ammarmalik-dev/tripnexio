import type { NextRequest } from "next/server";
import { registerSchema } from "@/lib/validation/auth-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { registerCustomer } from "@/lib/auth/customer";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE_NAME, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/customer-session";
import { isRateLimited } from "@/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`customer-register:${ip}`)) {
    return jsonError(429, "Too many attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const result = await registerCustomer({
    fullName: parsed.data.fullName,
    mobile: parsed.data.mobile,
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (!result.ok) {
    return jsonError(400, result.error, result.field ? { [result.field]: [result.error] } : undefined);
  }

  const token = await createCustomerSessionToken({ sub: result.customer.id, email: result.customer.email, name: result.customer.name });

  const response = jsonSuccess({ id: result.customer.id, name: result.customer.name, email: result.customer.email }, 201);
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_SECONDS,
  });
  return response;
}
