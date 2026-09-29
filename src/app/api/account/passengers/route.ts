import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/get-customer-session";

/**
 * P15 — a signed-in customer's saved passengers, for "Existing Passenger" on
 * request forms (Flight_Special_Fare.md §6). Only the signed-in customer's
 * own passengers; the passport number is never returned, just whether one is
 * on file (the form then asks "Reuse passport details?").
 */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return jsonError(401, "Please sign in.");
  try {
    const passengers = await db.passenger.findMany({
      where: { customerId: session.id },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        dob: true,
        paxType: true,
        passportNumber: true,
        documents: { where: { type: "PASSPORT", fileUrl: { not: null } }, select: { id: true }, take: 1 },
      },
    });
    return jsonSuccess(
      passengers.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        dob: p.dob ? p.dob.toISOString().slice(0, 10) : null,
        paxType: p.paxType,
        hasPassportOnFile: Boolean(p.passportNumber) || p.documents.length > 0,
      }))
    );
  } catch (error) {
    console.error("[api/account/passengers]", error);
    return jsonError(500, "Couldn't load your saved passengers.");
  }
}
