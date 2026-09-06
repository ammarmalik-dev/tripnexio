import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: { payments: true, documents: true, lead: true, customer: true },
  });
  if (!booking) return jsonError(404, "Booking not found.");

  return jsonSuccess(booking);
}
