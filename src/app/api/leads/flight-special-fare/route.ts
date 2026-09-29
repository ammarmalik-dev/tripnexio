import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { flightSpecialFareRequestSchema } from "@/lib/validation/flight-special-fare-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { computePaxType } from "@/lib/leads/pax-type";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { createTask } from "@/lib/tasks/create-task";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-flight-special-fare", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = flightSpecialFareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const { fullName, mobile, email, origin, destination, travelDate, returnDate } = parsed.data;

  // P15 — Flight_Special_Fare.md §6: saved passengers of a signed-in customer.
  // Their stored name / DOB / passport are used (never the client's copy), and
  // each one needs an answer to "Reuse passport details?".
  const savedIds = parsed.data.passengers.map((p) => p.savedPassengerId).filter((id): id is string => Boolean(id));
  let savedById = new Map<string, { id: string; fullName: string; dob: Date | null; passportNumber: string | null }>();
  if (savedIds.length > 0) {
    const session = await getCustomerSession();
    if (!session) return jsonError(401, "Sign in to use your saved passengers.");
    const saved = await db.passenger.findMany({
      where: { id: { in: savedIds }, customerId: session.id },
      select: { id: true, fullName: true, dob: true, passportNumber: true },
    });
    if (saved.length !== new Set(savedIds).size) {
      return jsonError(400, "One of the selected saved passengers isn't on your account.", { passengers: ["Invalid saved passenger."] });
    }
    savedById = new Map(saved.map((p) => [p.id, p]));
    const unanswered = parsed.data.passengers.findIndex((p) => p.savedPassengerId && p.reusePassport !== "yes" && p.reusePassport !== "no");
    if (unanswered >= 0) {
      return jsonError(400, "Tell us whether to reuse the passport details.", { [`passengers.${unanswered}.reusePassport`]: ["Choose Yes or No."] });
    }
  }
  const passengers = parsed.data.passengers.map((p) => {
    const saved = p.savedPassengerId ? savedById.get(p.savedPassengerId) : undefined;
    return {
      fullName: saved?.fullName ?? p.fullName,
      dob: saved?.dob ? saved.dob.toISOString().slice(0, 10) : p.dob,
      passportNumber: saved?.passportNumber ?? undefined,
      savedPassengerId: saved?.id ?? null,
      reusePassport: saved ? (p.reusePassport as "yes" | "no") : null,
    };
  });

  try {
    // Flight_Special_Fare.md §7: passenger type is computed from DOB on
    // travel date, never trusted from the client.
    const result = await createLeadFromSubmission({
      serviceType: "FLIGHT_SPECIAL_FARE",
      contact: { fullName, mobile, email },
      passengers: passengers.map((passenger) => ({
        fullName: passenger.fullName,
        dob: passenger.dob,
        ...(passenger.passportNumber ? { passportNumber: passenger.passportNumber } : {}),
        paxType: computePaxType(passenger.dob, travelDate),
      })),
      details: {
        origin,
        destination,
        travelDate,
        returnDate,
        passengerCount: passengers.length,
        // P15 — returning passengers and their "Reuse passport details?" answer, for staff.
        ...(passengers.some((p) => p.savedPassengerId)
          ? {
              passengerReuse: passengers
                .filter((p) => p.savedPassengerId)
                .map((p) => ({ fullName: p.fullName, reusePassport: p.reusePassport })),
            }
          : {}),
      },
    });

    // "No" means the passport on file can't be used: ask staff to collect an updated one.
    const needsNewPassport = passengers
      .map((p, index) => ({ ...p, passengerId: result.passengerIds[index] }))
      .filter((p) => p.reusePassport === "no");
    if (needsNewPassport.length > 0) {
      try {
        await db.$transaction(async (tx) => {
          for (const p of needsNewPassport) {
            await createTask(tx, {
              type: "DOCUMENT_COLLECTION",
              title: `Updated passport needed — ${p.fullName}`,
              reason: "Returning passenger chose not to reuse the passport details on file.",
              entityType: "Lead",
              entityId: result.leadId,
              leadId: result.leadId,
              passengerId: p.passengerId,
              serviceType: "FLIGHT_SPECIAL_FARE",
            });
          }
        });
      } catch (taskError) {
        console.error("[api/leads/flight-special-fare] passport task failed", describeError(taskError));
      }
    }
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/flight-special-fare]", describeError(error));
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
