import { db } from "../db";
import { Prisma, type ServiceType } from "../../generated/prisma/client";
import { formatLeadReference } from "./reference";
import { writeAudit } from "../audit/log";

export interface LeadContact {
  fullName: string;
  mobile: string;
  email: string;
}

export interface LeadPassengerInput {
  fullName: string;
  paxType?: "ADULT" | "CHILD";
  nationality?: string;
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
}

/** Reuses an existing Customer by mobile (primary) or email so returning customers keep their history. */
async function findOrCreateCustomer(tx: Prisma.TransactionClient, contact: LeadContact) {
  let customer = await tx.customer.findUnique({ where: { mobile: contact.mobile } });
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

/** Reuses an existing Passenger (matched by name, case-insensitive) under the customer instead of duplicating it. */
async function findOrCreatePassengers(
  tx: Prisma.TransactionClient,
  customerId: string,
  passengers: LeadPassengerInput[]
) {
  const ids: string[] = [];
  for (const passenger of passengers) {
    const existing = await tx.passenger.findFirst({
      where: { customerId, fullName: { equals: passenger.fullName, mode: "insensitive" } },
    });
    const record =
      existing ??
      (await tx.passenger.create({
        data: {
          customerId,
          fullName: passenger.fullName,
          paxType: passenger.paxType ?? "ADULT",
          nationality: passenger.nationality,
        },
      }));
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
    }
  }

  return db.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, contact);
    const passengerIds = await findOrCreatePassengers(tx, customer.id, safePassengers);

    const lead = await tx.lead.create({
      data: {
        customerId: customer.id,
        serviceType,
        source: source ?? "Website",
        details: { ...safeDetails, passengerIds } as Prisma.InputJsonValue,
      },
    });

    await writeAudit(tx, {
      entityType: "Lead",
      entityId: lead.id,
      action: "CREATE",
      note: `${serviceType} lead created via website for customer ${customer.id}`,
    });

    return {
      leadId: lead.id,
      referenceId: formatLeadReference(serviceType, lead.id),
      customerId: customer.id,
      status: lead.status,
    };
  });
}
