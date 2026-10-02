import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { enquiryConvertSchema } from "@/lib/enquiries/schemas";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * "Convert to Lead": a genuine business enquiry becomes a lead for the
 * chosen service through the normal intake pipeline (customer matching,
 * reference, auto-assignment, "request received" notifications). The
 * enquiry is kept, marked CONVERTED and linked to the new lead. Complaints
 * can't be converted — they stay in escalation.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
  const parsed = enquiryConvertSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { serviceType } = parsed.data;
  const scopeError = assertServiceAccess(session, serviceType);
  if (scopeError) return scopeError;

  const enquiry = await db.enquiry.findUnique({ where: { id } });
  if (!enquiry) return jsonError(404, "Enquiry not found.");
  if (enquiry.category === "COMPLAINT") return jsonError(409, "Complaints stay in escalation and can't be converted to a lead.");
  if (enquiry.convertedLeadId || enquiry.status === "CONVERTED") return jsonError(409, "This enquiry has already been converted to a lead.");

  try {
    const lead = await createLeadFromSubmission({
      serviceType,
      source: "Contact form enquiry",
      contact: { fullName: enquiry.fullName, mobile: enquiry.mobile, email: enquiry.email },
      details: {
        enquiryReference: enquiry.reference,
        subject: enquiry.subject,
        message: enquiry.message,
        ...(enquiry.bookingReference ? { bookingReference: enquiry.bookingReference } : {}),
      },
    });

    await db.$transaction(async (tx) => {
      await tx.enquiry.update({
        where: { id },
        data: { status: "CONVERTED", convertedLeadId: lead.leadId, customerId: lead.customerId, resolvedAt: new Date() },
      });
      await writeAudit(tx, {
        entityType: "Enquiry",
        entityId: id,
        action: "CONVERT",
        byUserId: session.id,
        note: `${enquiry.reference} converted to ${SERVICE_TYPE_LABELS[serviceType]} lead ${lead.referenceId} (by ${session.name})`,
      });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.leadId,
        action: "CREATE_FROM_ENQUIRY",
        byUserId: session.id,
        note: `Created from Contact-form enquiry ${enquiry.reference} (by ${session.name})`,
      });
    });

    return jsonSuccess({ leadId: lead.leadId, referenceId: lead.referenceId }, 201);
  } catch (error) {
    console.error("[api/enquiries/[id]/convert] failed", error);
    return jsonError(500, "Couldn't convert the enquiry. Please try again.");
  }
}
