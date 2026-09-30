import { db } from "../db";
import type { Prisma } from "../../generated/prisma/client";
import type { ReportFilters } from "./types";

/**
 * P25 - turns the shared report filters into a Lead where-clause (service,
 * destination country, assigned staff, selected-quotation vendor). Country
 * is matched the way the intake flows store it: details.destinationCountryId
 * (Return Ticket), or details.destinationCountry holding the Country code
 * (New Visa, OTB) or name. Date range is NOT included - each report applies
 * it to its own timestamp (booking created, payment succeeded, ...).
 */
export async function leadScopeWhere(filters: ReportFilters): Promise<Prisma.LeadWhereInput> {
  const and: Prisma.LeadWhereInput[] = [];
  if (filters.serviceType) and.push({ serviceType: filters.serviceType });
  if (filters.staffId) and.push({ assignedStaffId: filters.staffId });
  if (filters.vendorId) and.push({ quotations: { some: { isSelected: true, vendorId: filters.vendorId } } });
  if (filters.countryId) {
    const country = await db.country.findUnique({ where: { id: filters.countryId }, select: { id: true, code: true, name: true } });
    if (!country) {
      and.push({ id: "__no_such_country__" });
    } else {
      and.push({
        OR: [
          { details: { path: ["destinationCountryId"], equals: country.id } },
          { details: { path: ["destinationCountry"], equals: country.code } },
          { details: { path: ["destinationCountry"], equals: country.name } },
        ],
      });
    }
  }
  return and.length ? { AND: and } : {};
}

/** Same scope for Booking queries (through the booking's lead). */
export async function bookingScopeWhere(filters: ReportFilters): Promise<Prisma.BookingWhereInput> {
  const lead = await leadScopeWhere(filters);
  return Object.keys(lead).length ? { lead } : {};
}

/** Same scope for Payment queries (through payment -> booking -> lead). */
export async function paymentScopeWhere(filters: ReportFilters): Promise<Prisma.PaymentWhereInput> {
  const lead = await leadScopeWhere(filters);
  return Object.keys(lead).length ? { booking: { lead } } : {};
}

export const round2 = (value: number) => Math.round(value * 100) / 100;
