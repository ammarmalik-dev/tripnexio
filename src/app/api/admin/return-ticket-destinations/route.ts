import type { NextRequest } from "next/server";
import { createReturnTicketDestinationSchema } from "@/lib/validation/return-ticket-destination-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { serializeDestination } from "@/lib/return-ticket/serialize-destination";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const destinations = await db.returnTicketDestination.findMany({
    orderBy: [{ displayOrder: "asc" }, { country: { name: "asc" } }],
    include: { country: { select: { name: true, code: true } } },
  });
  return jsonSuccess(destinations.map(serializeDestination));
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createReturnTicketDestinationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
  if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  const existing = await db.returnTicketDestination.findUnique({ where: { countryId: country.id } });
  if (existing) {
    return jsonError(400, "This country is already set up for Return Ticket.", { countryId: ["Already added."] });
  }

  const created = await db.$transaction(async (tx) => {
    const row = await tx.returnTicketDestination.create({
      data: parsed.data,
      include: { country: { select: { name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "ReturnTicketDestination",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Return Ticket destination "${row.country.name}" added at rate ${parsed.data.ratePerApplicant} (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(serializeDestination(created), 201);
}
