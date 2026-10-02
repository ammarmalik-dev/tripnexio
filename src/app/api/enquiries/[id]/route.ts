import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { getAuditTimeline } from "@/lib/audit/timeline";
import { notifyStaff } from "@/lib/staff-notifications/notify";
import { enquiryUpdateSchema } from "@/lib/enquiries/schemas";
import { ENQUIRY_CATEGORY_LABELS, ENQUIRY_STATUS_LABELS } from "@/lib/enquiries/labels";
import { leadReference } from "@/lib/leads/reference";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function loadEnquiry(id: string) {
  return db.enquiry.findUnique({
    where: { id },
    include: {
      assignedStaff: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      convertedLead: { select: { id: true, reference: true, serviceType: true, createdAt: true } },
    },
  });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const enquiry = await loadEnquiry(id);
    if (!enquiry) return jsonError(404, "Enquiry not found.");
    const timeline = await getAuditTimeline([{ entityType: "Enquiry", entityId: id }]);
    return jsonSuccess({
      ...enquiry,
      convertedLead: enquiry.convertedLead ? { ...enquiry.convertedLead, referenceId: leadReference(enquiry.convertedLead) } : null,
      timeline: timeline.entries,
    });
  } catch (error) {
    console.error("[api/enquiries/[id]] load failed", error);
    return jsonError(500, "Couldn't load the enquiry. Please try again.");
  }
}

/**
 * Change category / status / assignee / resolution note. Moving an enquiry
 * into COMPLAINT escalates it (managers notified); resolving a complaint
 * needs a resolution note. A converted enquiry is read-only apart from notes.
 */
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
  const parsed = enquiryUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const changes = parsed.data;

  const existing = await db.enquiry.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Enquiry not found.");
  if (existing.status === "CONVERTED") return jsonError(409, "This enquiry was converted to a lead; update the lead instead.");

  const category = changes.category ?? existing.category;
  const status = changes.status ?? existing.status;
  const resolutionNote = changes.resolutionNote !== undefined ? changes.resolutionNote : existing.resolutionNote;
  const closing = (status === "RESOLVED" || status === "CLOSED") && status !== existing.status;
  if (closing && category === "COMPLAINT" && !resolutionNote) {
    return jsonError(400, "Add a resolution note before resolving or closing a complaint.", { resolutionNote: ["Describe how the complaint was resolved."] });
  }
  if (changes.assignedStaffId) {
    const staff = await db.user.findUnique({ where: { id: changes.assignedStaffId }, select: { active: true } });
    if (!staff?.active) return jsonError(400, "Please check the highlighted fields.", { assignedStaffId: ["Choose an active staff member."] });
  }
  const escalating = category === "COMPLAINT" && existing.category !== "COMPLAINT";

  const notes: string[] = [];
  if (changes.category && changes.category !== existing.category) notes.push(`category ${ENQUIRY_CATEGORY_LABELS[existing.category]} → ${ENQUIRY_CATEGORY_LABELS[changes.category]}`);
  if (changes.status && changes.status !== existing.status) notes.push(`status ${ENQUIRY_STATUS_LABELS[existing.status]} → ${ENQUIRY_STATUS_LABELS[changes.status]}`);
  if (changes.assignedStaffId !== undefined && changes.assignedStaffId !== existing.assignedStaffId) notes.push(changes.assignedStaffId ? "assignee changed" : "unassigned");
  if (changes.resolutionNote !== undefined && changes.resolutionNote !== existing.resolutionNote) notes.push("resolution note updated");
  if (escalating) notes.push("escalated as a complaint");

  try {
    await db.$transaction(async (tx) => {
      await tx.enquiry.update({
        where: { id },
        data: {
          ...changes,
          ...(escalating && !existing.escalatedAt ? { escalatedAt: new Date() } : {}),
          ...(closing ? { resolvedAt: new Date() } : {}),
          ...(status === "NEW" || status === "IN_PROGRESS" ? { resolvedAt: null } : {}),
        },
      });
      if (notes.length > 0) {
        await writeAudit(tx, {
          entityType: "Enquiry",
          entityId: id,
          action: escalating ? "ESCALATE" : "UPDATE",
          byUserId: session.id,
          note: `${existing.reference}: ${notes.join("; ")} (by ${session.name})`,
        });
      }
    });

    if (escalating) {
      await notifyStaff({
        type: "COMPLAINT",
        title: `Complaint ${existing.reference}: ${existing.subject}`,
        body: `${session.name} marked this Contact-form enquiry from ${existing.fullName} as a complaint. It has been escalated.`,
        link: `/crm/enquiries/${id}`,
        entityType: "Enquiry",
        entityId: id,
        recipients: { permission: "leads.reassign" },
      });
    }
    if (changes.assignedStaffId && changes.assignedStaffId !== existing.assignedStaffId && changes.assignedStaffId !== session.id) {
      await notifyStaff({
        type: category === "COMPLAINT" ? "COMPLAINT" : "NEW_ENQUIRY",
        title: `${existing.reference} assigned to you`,
        body: `${existing.fullName}: ${existing.subject}`,
        link: `/crm/enquiries/${id}`,
        entityType: "Enquiry",
        entityId: id,
        recipients: { userIds: [changes.assignedStaffId] },
      });
    }

    const updated = await loadEnquiry(id);
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/enquiries/[id]] update failed", error);
    return jsonError(500, "Couldn't update the enquiry. Please try again.");
  }
}
