import type { NextRequest } from "next/server";
import { createDocumentSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId") ?? undefined;
  const passengerId = searchParams.get("passengerId") ?? undefined;

  if (!bookingId && !passengerId) {
    return jsonError(400, "Provide a bookingId or passengerId query parameter.");
  }

  const documents = await db.document.findMany({
    where: { bookingId, passengerId },
    orderBy: { createdAt: "desc" },
  });
  return jsonSuccess(documents);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.passengerId) {
    const passenger = await db.passenger.findUnique({ where: { id: parsed.data.passengerId } });
    if (!passenger) {
      return jsonError(400, "Passenger not found.", { passengerId: ["No passenger with this id."] });
    }
  }
  if (parsed.data.bookingId) {
    const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
    if (!booking) {
      return jsonError(400, "Booking not found.", { bookingId: ["No booking with this id."] });
    }
  }

  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        passengerId: parsed.data.passengerId,
        bookingId: parsed.data.bookingId,
        type: parsed.data.type,
        status: parsed.data.status ?? "REQUIRED",
      },
    });

    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "CREATE",
      note: `Document requirement "${created.type}" created`,
    });

    return created;
  });

  return jsonSuccess(document, 201);
}
