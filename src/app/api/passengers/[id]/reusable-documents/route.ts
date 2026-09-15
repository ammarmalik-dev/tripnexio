import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { getReusableDocumentsForPassenger } from "@/lib/documents/reuse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * New_Visa.md §17 / Visa_Extension.md §16 (Step 21, audit §7.5) — "if a
 * passenger appears in a future booking," surface their own prior
 * documents (age + reuse eligibility) for staff to offer. `?excludeBookingId=`
 * drops documents already attached to the booking currently being worked
 * on (nothing to "offer" there — they're already in place).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;

  const { id: passengerId } = await params;

  const passenger = await db.passenger.findUnique({ where: { id: passengerId } });
  if (!passenger) return jsonError(404, "Passenger not found.");

  const { searchParams } = new URL(request.url);
  const excludeBookingId = searchParams.get("excludeBookingId");

  const documents = await getReusableDocumentsForPassenger(passengerId);
  const items = excludeBookingId ? documents.filter((doc) => doc.bookingId !== excludeBookingId) : documents;

  return jsonSuccess(items);
}
