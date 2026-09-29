import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getProcessingTypeOptions } from "@/lib/processing-types/get";
import { ServiceType } from "../../../generated/prisma/enums";

const serviceSchema = z.enum(Object.values(ServiceType) as [ServiceType, ...ServiceType[]]);

/**
 * Public, unauthenticated — P23 processing-type options (active only, Admin
 * order) for customer-facing forms. `?service=NEW_VISA`. Falls back to the
 * historical Normal/Express(Urgent) pair if the master is unreadable/empty.
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = serviceSchema.safeParse(request.nextUrl.searchParams.get("service"));
    if (!parsed.success) return jsonError(400, "Specify a valid service.", { service: ["Unknown service type."] });
    return jsonSuccess(await getProcessingTypeOptions(parsed.data));
  } catch {
    return jsonError(500, "Couldn't load processing types.");
  }
}
