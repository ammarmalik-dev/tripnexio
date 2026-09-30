import { jsonError } from "./respond";
import { sensitiveReasonSchema } from "@/lib/validation/sensitive-action";

type ReasonResult = { reason: string; error?: undefined } | { reason?: undefined; error: Response };

function reasonError(issueMessage: string | undefined): ReasonResult {
  const message = issueMessage ?? "Enter a reason for this action.";
  return { error: jsonError(400, message, { reason: [message] }) };
}

/**
 * Business Rules §14 — validates the required `reason` field of an
 * already-parsed JSON body. Kept separate from each route's own body schema
 * on purpose: those schemas' parsed data is often passed straight into a
 * Prisma `data` object, and zod's default "strip" mode drops `reason` there,
 * so it can never leak into a DB write.
 */
export function readBodyReason(body: unknown): ReasonResult {
  const raw = body && typeof body === "object" && "reason" in body ? (body as { reason: unknown }).reason : undefined;
  const parsed = sensitiveReasonSchema.safeParse(raw);
  if (!parsed.success) return reasonError(parsed.error.issues[0]?.message);
  return { reason: parsed.data };
}

/**
 * Business Rules §14 — reads the required confirmation reason for a DELETE
 * route. The client always sends it as `?reason=` (see `withReasonQuery`);
 * a JSON body `{ reason }` is accepted too as a fallback for non-browser
 * callers. A missing/short reason is a 400 with a `reason` field error.
 */
export async function readDeleteReason(request: Request): Promise<ReasonResult> {
  let raw: unknown = new URL(request.url).searchParams.get("reason");
  if (raw === null || raw === "") {
    try {
      const body: unknown = await request.json();
      if (body && typeof body === "object" && "reason" in body) raw = (body as { reason: unknown }).reason;
    } catch {
      // No body — fall through to the validation error below.
    }
  }
  const parsed = sensitiveReasonSchema.safeParse(raw ?? undefined);
  if (!parsed.success) return reasonError(parsed.error.issues[0]?.message);
  return { reason: parsed.data };
}
