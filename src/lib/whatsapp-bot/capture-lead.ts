import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { describeError } from "../api/describe-error";
import { createLeadFromSubmission } from "../leads/create-lead";
import { createOrRefreshDraftLead } from "../leads/create-draft-lead";
import { notifyStaff } from "../staff-notifications/notify";
import { SERVICE_TYPE_LABELS } from "../crm/labels";

const OPEN_LEAD_DAYS = 7;
const CLOSED_STATUSES = ["CONVERTED", "LOST", "CLOSED"] as const;

/** An open WhatsApp lead of this customer from the last week, so a repeated "agent" doesn't create duplicates. */
async function recentOpenWhatsAppLead(waId: string) {
  const customer = await db.customer.findFirst({ where: { mobile: { contains: waId.slice(-10) } }, select: { id: true } });
  if (!customer) return null;
  return db.lead.findFirst({
    where: {
      customerId: customer.id,
      source: "WhatsApp Bot",
      status: { notIn: [...CLOSED_STATUSES] },
      createdAt: { gte: new Date(Date.now() - OPEN_LEAD_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

/**
 * Client feedback 2026-10-07 — a WhatsApp customer who asks for an agent
 * must reach a person: make sure there's a lead staff can reply from (its
 * Communications tab shows the chat), and tell the team now. Reuses an open
 * WhatsApp lead from the last week; otherwise creates one through the normal
 * intake pipeline (which also assigns a POC and notifies staff). Never throws.
 */
export async function captureWhatsAppHandoff(input: {
  waId: string;
  profileName: string | null;
  serviceType: ServiceType | null;
  collected: Record<string, string>;
}): Promise<void> {
  try {
    const existing = await recentOpenWhatsAppLead(input.waId);
    let leadId = existing?.id ?? null;
    if (!leadId) {
      const result = await createLeadFromSubmission({
        serviceType: input.serviceType ?? "OTHER",
        source: "WhatsApp Bot",
        contact: { fullName: input.collected.fullName || input.profileName || "WhatsApp customer", mobile: input.waId, email: input.collected.email ?? "" },
        details: {
          ...input.collected,
          whatsappHandoff: true,
          requestedAgentAt: new Date().toISOString(),
          ...(input.serviceType ? {} : { otherServiceDescription: "Asked to talk to an agent on WhatsApp" }),
        },
      });
      leadId = result.leadId;
    }
    await notifyStaff({
      type: "NEW_LEAD",
      title: `WhatsApp: ${input.profileName ?? `+${input.waId}`} asked to talk to an agent`,
      body: input.serviceType ? `About ${SERVICE_TYPE_LABELS[input.serviceType]}. Reply from the lead's Communication tab.` : "Reply from the lead's Communication tab.",
      link: `/crm/leads/${leadId}#tab-communication`,
      entityType: "Lead",
      entityId: leadId,
      recipients: { permission: "leads.view", serviceType: input.serviceType },
    });
  } catch (error) {
    console.error("[whatsapp-bot] handoff lead capture failed", describeError(error));
  }
}

/**
 * New Visa over WhatsApp hands over to the website form (passport copies
 * can't be collected in chat) — but staff still see the enquiry right away as
 * a draft lead, which the website submission then takes over (same lead, no
 * duplicate). Never throws.
 */
export async function captureWhatsAppNewVisaDraft(input: { waId: string; profileName: string | null; collected: Record<string, string> }): Promise<void> {
  try {
    const draft = await createOrRefreshDraftLead("NEW_VISA", {
      fullName: input.collected.fullName || input.profileName || "WhatsApp customer",
      mobile: input.waId,
      email: input.collected.email ?? "",
    });
    if (draft.outcome === "created") {
      await notifyStaff({
        type: "NEW_LEAD",
        title: `WhatsApp New Visa enquiry: ${input.collected.fullName || input.profileName || `+${input.waId}`}`,
        body: "Sent the website form link. Follow up if it isn't submitted.",
        link: `/crm/leads/${draft.leadId}`,
        entityType: "Lead",
        entityId: draft.leadId,
        recipients: { permission: "leads.view", serviceType: "NEW_VISA" },
      });
    }
  } catch (error) {
    console.error("[whatsapp-bot] new visa draft capture failed", describeError(error));
  }
}
