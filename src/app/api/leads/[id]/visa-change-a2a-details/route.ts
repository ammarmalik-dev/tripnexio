import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { findActiveAirlineByCode } from "@/lib/airlines/find-active-airline";
import type { Prisma } from "@/generated/prisma/client";
import type { A2ABlock } from "@/lib/visa-change/operational";

/**
 * Visa_Change.md §5/§6/§13 (P14) — the Airport-to-Airport operational
 * details staff enter on the lead: entry and exit airport from the common
 * Airport master (only airports enabled for A2A entry / exit), airline from
 * the Airline master, flight, date, time, reporting time, vendor/sponsor,
 * cost and selling price. Every field is required — a saved block is
 * always complete, and quoting an A2A lead needs one.
 */
const a2aSchema = z.object({
  entryAirportId: z.string().min(1, "Select the entry airport"),
  exitAirportId: z.string().min(1, "Select the exit airport"),
  airlineCode: z.string().trim().min(1, "Select the airline"),
  flightNumber: z.string().trim().min(2, "Enter the flight number").max(12),
  flightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the flight date"),
  flightTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the flight time (HH:MM)"),
  // Client corrections 2026-10-05 §8 — the return leg makes it one complete round trip.
  returnAirlineCode: z.string().trim().min(1, "Select the return airline"),
  returnFlightNumber: z.string().trim().min(2, "Enter the return flight number").max(12),
  returnFlightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the return flight date"),
  returnFlightTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the return flight time (HH:MM)"),
  reportingTime: z.string().trim().min(1, "Enter the reporting time").max(40),
  vendorId: z.string().min(1, "Select the vendor/sponsor"),
  cost: z.number({ error: "Enter the cost" }).nonnegative("Cost can't be negative"),
  sellingPrice: z.number({ error: "Enter the selling price" }).nonnegative("Selling price can't be negative"),
  instructions: z
    .string()
    .trim()
    .max(1500)
    .optional()
    .transform((value) => (value ? value : null)),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

const airportLabel = (airport: { name: string; code: string }) => `${airport.name} (${airport.code})`;

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = a2aSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  if (lead.serviceType !== "VISA_CHANGE") return jsonError(409, "This action only applies to Visa Change leads.");
  if ((lead.details as Record<string, unknown> | null)?.changeType !== "AIRPORT_TO_AIRPORT") {
    return jsonError(409, "This lead is a Border Exit request — use the Border details instead.");
  }

  if (`${input.returnFlightDate}T${input.returnFlightTime}` <= `${input.flightDate}T${input.flightTime}`) {
    return jsonError(400, "The return flight must be after the onward flight.", { returnFlightDate: ["Must be after the onward flight."] });
  }

  const [entry, exit, airline, returnAirline, vendor] = await Promise.all([
    db.airport.findUnique({ where: { id: input.entryAirportId } }),
    db.airport.findUnique({ where: { id: input.exitAirportId } }),
    findActiveAirlineByCode(input.airlineCode),
    findActiveAirlineByCode(input.returnAirlineCode),
    db.vendor.findUnique({ where: { id: input.vendorId } }),
  ]);
  if (!entry || !entry.active) {
    return jsonError(400, "Select a valid entry airport.", { entryAirportId: ["This airport isn't enabled for A2A entry."] });
  }
  if (!exit || !exit.active) {
    return jsonError(400, "Select a valid exit airport.", { exitAirportId: ["This airport isn't enabled for A2A exit."] });
  }
  if (!airline) return jsonError(400, "Select a valid, active airline.", { airlineCode: ["This airline isn't available."] });
  if (!returnAirline) return jsonError(400, "Select a valid, active return airline.", { returnAirlineCode: ["This airline isn't available."] });
  if (!vendor || !vendor.active) return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });

  const block: A2ABlock = {
    kind: "A2A",
    entryAirportId: entry.id,
    entryAirport: airportLabel(entry),
    exitAirportId: exit.id,
    exitAirport: airportLabel(exit),
    airlineCode: airline.code,
    airline: airline.name,
    flightNumber: input.flightNumber.toUpperCase(),
    flightDate: input.flightDate,
    flightTime: input.flightTime,
    returnAirlineCode: returnAirline.code,
    returnAirline: returnAirline.name,
    returnFlightNumber: input.returnFlightNumber.toUpperCase(),
    returnFlightDate: input.returnFlightDate,
    returnFlightTime: input.returnFlightTime,
    reportingTime: input.reportingTime,
    vendorId: vendor.id,
    vendorName: vendor.name,
    cost: input.cost,
    sellingPrice: input.sellingPrice,
    instructions: input.instructions,
  };

  try {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id },
        data: {
          details: {
            ...((lead.details as Record<string, unknown>) ?? {}),
            a2aOperationalDetails: { ...block, confirmedByStaffId: session.id, confirmedAt: new Date().toISOString() },
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "VISA_CHANGE_A2A_DETAILS_CONFIRMED",
        byUserId: session.id,
        note: `A2A round trip confirmed: out ${block.exitAirport} ${block.airline} ${block.flightNumber} on ${block.flightDate} ${block.flightTime}, back to ${block.entryAirport} ${block.returnAirline} ${block.returnFlightNumber} on ${block.returnFlightDate} ${block.returnFlightTime} (by ${session.name})`,
      });
      return result;
    });
    return jsonSuccess({ leadId: updated.id, a2aOperationalDetails: (updated.details as Record<string, unknown>).a2aOperationalDetails });
  } catch (error) {
    console.error("[leads/visa-change-a2a-details]", error);
    return jsonError(500, "Couldn't save the A2A details. Please try again.");
  }
}
