import { jsonSuccess } from "@/lib/api/respond";
import { CUSTOMER_SESSION_COOKIE_NAME } from "@/lib/auth/customer-session";

export async function POST() {
  const response = jsonSuccess({ loggedOut: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
