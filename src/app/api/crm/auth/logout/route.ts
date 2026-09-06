import { jsonSuccess } from "@/lib/api/respond";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  const response = jsonSuccess({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
