import type { NextRequest } from "next/server";
import { updateReturnTicketDestinationSchema } from "@/lib/validation/return-ticket-destination-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { serializeDestination } from "@/lib/return-ticket/serialize-destination";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateReturnTicketDestinationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  // The country is fixed once added — to change it, disable this row and add another.
  const data = { ...parsed.data };
  delete data.countryId;

  const existing = await db.returnTicketDestination.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Destination not found.");

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.returnTicketDestination.update({
      where: { id },
      data,
      include: { country: { select: { name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "ReturnTicketDestination",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Return Ticket destination "${row.country.name}" updated (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(serializeDestination(updated));
}
