import { createRemoteJWKSet, jwtVerify } from "jose";
import { isPlaceholder } from "../env-placeholder";
import { siteConfig } from "../site-config";

/**
 * P09 — Google Sign-In (OpenID Connect authorization-code flow) for both
 * customers and staff, only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are
 * set. Buttons are hidden otherwise. Google only proves the email address:
 * a customer must already have an account with it, and staff sign-in only
 * matches an existing active User — Google never creates staff.
 */
export function isGoogleSignInConfigured(): boolean {
  return !isPlaceholder(process.env.GOOGLE_CLIENT_ID) && !isPlaceholder(process.env.GOOGLE_CLIENT_SECRET);
}

export const GOOGLE_STATE_COOKIE = "tnx_google_oauth";
export const GOOGLE_STATE_TTL_SECONDS = 10 * 60;

export function googleRedirectUri(): string {
  return `${siteConfig.url}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Exchanges the callback code and verifies Google's ID token (signature, audience, issuer, verified email). */
export async function verifiedGoogleIdentity(code: string): Promise<{ email: string; name: string } | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { id_token?: string };
  if (!json.id_token) return null;

  const { payload } = await jwtVerify(json.id_token, googleJwks, {
    audience: process.env.GOOGLE_CLIENT_ID,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  if (payload.email_verified !== true || typeof payload.email !== "string") return null;
  return { email: payload.email.toLowerCase(), name: typeof payload.name === "string" ? payload.name : payload.email };
}

/** Only same-site relative paths are followed after sign-in (never "//host" or "/\host"). */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
