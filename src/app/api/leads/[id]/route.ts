import { subServiceLabel } from "@/lib/leads/sub-service-label";
import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { buildApplicantRows } from "@/lib/new-visa/applicants";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { getLeadRelatedEntityRefs } from "@/lib/leads/related-entities";
import { findPriorTripNexioVisaByPassport } from "@/lib/leads/visa-extension-eligibility";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          // Only this lead's own passengers are shown (client corrections 2026-10-05:
          // the customer's other leads/bookings belong to Customer 360, not here).
          passengers: { include: { documents: true } },
        },
      },
      assignedStaff: true,
      country: { select: { name: true } },
      quotations: { orderBy: { createdAt: "desc" } },
      bookings: { include: { payments: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;

  const quotations = await syncExpiredQuotations(lead.quotations);

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];
  const leadPassengers = lead.customer.passengers.filter((passenger) => passengerIds.includes(passenger.id));

  // Visa Extension handover doc: staff see, per applicant, whether that
  // passport number already has a visa issued through TripNexio.
  const priorVisaMatches =
    lead.serviceType === "VISA_EXTENSION"
      ? await Promise.all(
          leadPassengers
            .filter((passenger) => passenger.passportNumber)
            .map(async (passenger) => {
              const match = await findPriorTripNexioVisaByPassport(passenger.passportNumber as string);
              return {
                passengerId: passenger.id,
                fullName: passenger.fullName,
                passportNumber: passenger.passportNumber as string,
                match,
              };
            })
        )
      : [];

  const entityRefs = await getLeadRelatedEntityRefs(id);

  const timeline =
    entityRefs.length > 0
      ? await db.auditTrail.findMany({
          where: { OR: entityRefs },
          include: { byUser: true },
          orderBy: { timestamp: "asc" },
        })
      : [];

  return jsonSuccess({
    id: lead.id,
    referenceId: leadReference(lead),
    // P11 — every applicant with passport, DOB, occupation, pax type and guardian.
    applicants: buildApplicantRows(lead.details, lead.customer.passengers),
    serviceType: lead.serviceType,
    status: lead.status,
    temperature: lead.temperature,
    source: lead.source,
    details: lead.details,
    createdAt: lead.createdAt,
    // Client corrections 2026-10-05 §18 — the record header's key summary.
    countryName: lead.country?.name ?? null,
    travelDate: lead.travelDate ? lead.travelDate.toISOString().slice(0, 10) : null,
    paxCount: lead.paxCount,
    subService: subServiceLabel(lead.details),
    // Step 50 — `active` lets the UI show "Unassigned (was: Name)" for a
    // record whose assignee has since been deactivated, instead of quietly
    // rendering a name that no longer means the lead has an active owner.
    assignedStaff: lead.assignedStaff
      ? { id: lead.assignedStaff.id, name: lead.assignedStaff.name, email: lead.assignedStaff.email, active: lead.assignedStaff.active }
      : null,
    customer: {
      id: lead.customer.id,
      name: lead.customer.name,
      mobile: lead.customer.mobile,
      email: lead.customer.email,
      createdAt: lead.customer.createdAt,
    },
    passengers: leadPassengers.map((passenger) => ({
      id: passenger.id,
      fullName: passenger.fullName,
      paxType: passenger.paxType,
      nationality: passenger.nationality,
      passportNumber: passenger.passportNumber,
      documents: passenger.documents.map((document) => ({
        id: document.id,
        type: document.type,
        status: document.status,
        fileUrl: document.fileUrl,
        purgedAt: document.purgedAt,
      })),
    })),
    priorVisaMatches,
    quotations,
    bookings: lead.bookings,
    timeline: timeline.map((entry) => ({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      note: entry.note,
      timestamp: entry.timestamp,
      byUser: entry.byUser ? { name: entry.byUser.name } : null,
    })),
  });
}
