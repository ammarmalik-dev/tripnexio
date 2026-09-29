import { db } from "../db";
import { Prisma, type Lead, type ServiceType } from "../../generated/prisma/client";
import { nextLeadReference } from "./reference";
import { getInitialServiceStatusId } from "../service-status/engine";
import { writeAudit } from "../audit/log";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { generateToken } from "../quotations/select-quotation";
import { findCustomerByMobile } from "../customers/find-by-mobile";
import { findOpenDraftLead } from "./abandoned-draft";
import { autoAssignLead } from "../staff/auto-assign";
import { notifyStaff } from "@/lib/staff-notifications/notify";

/**
 * The services that go through a staff-prepared quotation the customer
 * reviews at /quote/<token>. New Visa moved OFF this list in Step 35 — it
 * now pays right after the form, like OTB/Return Ticket, since its price is
 * auto-computable from Admin-configured country+processing-type rates.
 */
const QUOTE_REVIEW_SERVICES = new Set<ServiceType>(["VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE"]);

export interface LeadContact {
  fullName: string;
  mobile: string;
  email: string;
}

export interface LeadPassengerInput {
  fullName: string;
  paxType?: "ADULT" | "CHILD" | "INFANT";
  nationality?: string;
  /** Nationality master id, when the form picked one (P06). */
  nationalityId?: string;
  passportNumber?: string;
  /** ISO date string (YYYY-MM-DD). */
  dob?: string;
}

export interface CreateLeadInput {
  serviceType: ServiceType;
  source?: string;
  contact: LeadContact;
  /** Defaults to a single passenger derived from `contact.fullName` when omitted. */
  passengers?: LeadPassengerInput[];
  /** Service-specific fields already validated by that service's own zod schema. */
  details: Record<string, unknown>;
}

export interface CreateLeadResult {
  leadId: string;
  referenceId: string;
  customerId: string;
  status: string;
  /** In submission order, matching `input.passengers` (or the single default passenger derived from `contact.fullName`). */
  passengerIds: string[];
}

/** Reuses an existing Customer by normalised mobile (primary) or email so returning customers keep their history. */
export async function findOrCreateCustomer(tx: Prisma.TransactionClient, contact: LeadContact) {
  let customer = await findCustomerByMobile(tx, contact.mobile);
  if (!customer && contact.email) {
    customer = await tx.customer.findUnique({ where: { email: contact.email } });
  }
  if (!customer) {
    customer = await tx.customer.create({
      data: { name: contact.fullName, mobile: contact.mobile, email: contact.email || null },
    });
  }
  return customer;
}

/**
 * Reuses an existing Passenger under the customer instead of duplicating it:
 * matched by passport number first (case-insensitive), then by name. A
 * reused passenger picks up a nationality it didn't have yet.
 */
async function findOrCreatePassengers(
  tx: Prisma.TransactionClient,
  customerId: string,
  passengers: LeadPassengerInput[]
) {
  const ids: string[] = [];
  for (const passenger of passengers) {
    const passportNumber = passenger.passportNumber?.trim();
    const existing =
      (passportNumber
        ? await tx.passenger.findFirst({
            where: { customerId, passportNumber: { equals: passportNumber, mode: "insensitive" } },
            orderBy: { createdAt: "asc" },
          })
        : null) ??
      (await tx.passenger.findFirst({
        where: { customerId, fullName: { equals: passenger.fullName, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
      }));

    if (existing) {
      if (passenger.nationalityId && !existing.nationalityId) {
        await tx.passenger.update({
          where: { id: existing.id },
          data: { nationalityId: passenger.nationalityId, nationality: passenger.nationality ?? existing.nationality },
        });
      }
      ids.push(existing.id);
      continue;
    }

    const record = await tx.passenger.create({
      data: {
        customerId,
        fullName: passenger.fullName,
        paxType: passenger.paxType ?? "ADULT",
        nationality: passenger.nationality,
        nationalityId: passenger.nationalityId,
        passportNumber: passenger.passportNumber,
        dob: passenger.dob ? new Date(passenger.dob) : undefined,
      },
    });
    ids.push(record.id);
  }
  return ids;
}

/**
 * Shared Customer-match/create + Passenger-match/create + Lead-create
 * transaction used by every service's lead-intake API route (OTB, New
 * Visa, Visa Extension, Visa Change, Flight Special Fare, Return Ticket).
 *
 * Enforces one cross-cutting spec rule server-side, not just by frontend
 * field omission (per CLAUDE.md "validate every mutation server-side"):
 * OTB requests never store a nationality, even if one somehow arrives in
 * `details` or a passenger entry.
 */
export async function createLeadFromSubmission(input: CreateLeadInput): Promise<CreateLeadResult> {
  const { serviceType, source, contact, details } = input;
  const passengers = input.passengers?.length ? input.passengers : [{ fullName: contact.fullName }];

  const safeDetails = { ...details };
  const safePassengers = passengers.map((passenger) => ({ ...passenger }));
  if (serviceType === "OTB") {
    delete (safeDetails as Record<string, unknown>).nationality;
    for (const passenger of safePassengers) {
      delete passenger.nationality;
      delete passenger.nationalityId;
    }
  }

  const result = await db.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, contact);
    const passengerIds = await findOrCreatePassengers(tx, customer.id, safePassengers);

    // A customer review/payment token is only useful for the services that
    // actually get a staff-prepared quotation to review (see
    // QUOTE_REVIEW_SERVICES) — OTB/Return Ticket skip straight to a
    // Booking.customerToken via the automatic checkout instead.
    const customerToken = QUOTE_REVIEW_SERVICES.has(serviceType) ? generateToken() : undefined;

    // P21 — abandoned-form takeover. If this customer left a step-1 draft
    // for the same service (POST /api/leads/draft), the full submission
    // completes THAT Lead row instead of creating a second one: same id,
    // same reference, staff's existing notes/assignment/status kept;
    // details are replaced by the real submission (which clears
    // `abandonedDraft`) and `source` becomes the real source.
    const draft = await findOpenDraftLead(tx, customer.id, serviceType);
    let lead: Lead;
    let reference: string;
    if (draft) {
      reference = draft.reference ?? (await nextLeadReference(tx, serviceType));
      lead = await tx.lead.update({
        where: { id: draft.id },
        data: {
          source: source ?? "Website",
          reference,
          details: { ...safeDetails, passengerIds, completedFromDraft: true } as Prisma.InputJsonValue,
          customerToken: draft.customerToken ?? customerToken,
          serviceStatusId: draft.serviceStatusId ?? (await getInitialServiceStatusId(tx, serviceType, "LEAD")),
        },
      });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "DRAFT_COMPLETED",
        note: `Abandoned ${serviceType} draft completed — full form submitted via ${source ?? "Website"} for customer ${customer.id}`,
      });
    } else {
      // Locked reference (1 + MM + YY + ServiceCode + monthly sequence), taken
      // from the shared counter in this same transaction.
      reference = await nextLeadReference(tx, serviceType);
      lead = await tx.lead.create({
        data: {
          customerId: customer.id,
          serviceType,
          source: source ?? "Website",
          reference,
          serviceStatusId: await getInitialServiceStatusId(tx, serviceType, "LEAD"),
          details: { ...safeDetails, passengerIds } as Prisma.InputJsonValue,
          customerToken,
        },
      });

      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "CREATE",
        note: `${serviceType} lead created via ${source ?? "Website"} for customer ${customer.id}`,
      });
    }

    return {
      leadId: lead.id,
      referenceId: reference,
      customerId: customer.id,
      status: lead.status,
      customerName: customer.name,
      customerEmail: customer.email,
      customerMobile: customer.mobile,
      passengerIds,
      assignedStaffId: lead.assignedStaffId,
    };
  });

  // P22 item 8 — Admin roster auto-assignment, run AFTER the transaction
  // commits (never the global client inside an open transaction). A
  // completed abandoned draft is assigned here too (its details no longer
  // carry `abandonedDraft`); a bare draft never reaches this function —
  // createOrRefreshDraftLead() is separate and deliberately not assigned.
  // Never throws; no eligible staff → the lead stays unassigned.
  let assigneeId = result.assignedStaffId;
  if (!assigneeId) {
    const autoAssigned = await autoAssignLead(result.leadId, serviceType);
    assigneeId = autoAssigned?.staffId ?? null;
  }

  // P22 item 8 — new-lead staff notification: the assignee if there is one,
  // otherwise everyone who can view leads for this service. notifyStaff()
  // never throws by contract.
  await notifyStaff({
    type: "NEW_LEAD",
    title: `New ${SERVICE_TYPE_LABELS[serviceType]} lead ${result.referenceId}`,
    body: `${result.customerName} submitted a ${SERVICE_TYPE_LABELS[serviceType]} request via ${source ?? "Website"}.`,
    link: `/crm/leads/${result.leadId}`,
    entityType: "Lead",
    entityId: result.leadId,
    recipients: assigneeId ? { userIds: [assigneeId] } : { permission: "leads.view", serviceType },
  });

  await notifyCustomer({
    event: NOTIFICATION_EVENTS.LEAD_RECEIVED,
    emailTo: result.customerEmail,
    whatsappTo: toWhatsAppId(result.customerMobile),
    smsTo: toWhatsAppId(result.customerMobile),
    variables: {
      customerName: result.customerName,
      serviceType: SERVICE_TYPE_LABELS[serviceType],
      leadReference: result.referenceId,
    },
    auditTarget: { entityType: "Lead", entityId: result.leadId },
  });

  return {
    leadId: result.leadId,
    referenceId: result.referenceId,
    customerId: result.customerId,
    status: result.status,
    passengerIds: result.passengerIds,
  };
}
