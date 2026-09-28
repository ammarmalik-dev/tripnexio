import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_TTL_SECONDS, googleAuthUrl, isGoogleSignInConfigured, safeNextPath } from "@/lib/auth/google";
import { rateLimitByIp } from "@/lib/auth/rate-limit";

/** P09 — begins Google Sign-In: `?for=customer|staff&next=/path`. 404 when Google isn't configured. */
export async function GET(request: NextRequest) {
  if (!isGoogleSignInConfigured()) return NextResponse.json({ error: { message: "Not found." } }, { status: 404 });
  const limited = await rateLimitByIp(request, "google-start", { limit: 30, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const target = params.get("for") === "staff" ? "staff" : "customer";
  const next = safeNextPath(params.get("next"), target === "staff" ? "/crm" : "/account");
  const state = crypto.randomBytes(16).toString("hex");

  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, target, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: GOOGLE_STATE_TTL_SECONDS,
  });
  return response;
}
