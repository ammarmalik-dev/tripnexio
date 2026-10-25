import { db } from "../db";
import type { Prisma } from "../../generated/prisma/client";
import { ServiceType } from "../../generated/prisma/enums";
import type { ReportFilters } from "./types";

/**
 * P25 - turns the shared report filters into Lead / Booking / Payment where-clauses.
 *
 * Lead-level filters: service, destination country, assigned staff, selected-quotation vendor,
 * sub-service and lead status. Country is matched the way the intake flows store it:
 * details.destinationCountryId (Return Ticket), or details.destinationCountry holding the Country
 * code (New Visa, OTB) or name.
 * Booking-level filters (Admin handover §15): booking status and payment status - applied to the
 * booking itself in booking/payment scopes, and as "has such a booking" in the lead scope.
 *
 * Every scope is an `{ AND: [...] }` (or `{}`), so callers can spread it next to their own
 * `status` / `createdAt` keys without one silently overriding the other.
 * Date range is NOT included - each report applies it to its own timestamp.
 */

export interface SubServiceFilterRow {
  id: string;
  serviceType: ServiceType;
  code: string;
  name: string;
}

const SERVICE_TYPE_VALUES = new Set<string>(Object.values(ServiceType));

/** "VISA_CHANGE:airport_to_airport" -> { serviceType, code }; null when malformed. */
export function parseSubServiceFilter(value: string | undefined): { serviceType: ServiceType; code: string } | null {
  if (!value) return null;
  const index = value.indexOf(":");
  if (index <= 0) return null;
  const serviceType = value.slice(0, index);
  const code = value.slice(index + 1).trim();
  if (!SERVICE_TYPE_VALUES.has(serviceType) || !code) return null;
  return { serviceType: serviceType as ServiceType, code };
}

/** Lead `details` keys that can carry the sub-service (see src/lib/vendors/sub-service-match.ts). */
const SUB_SERVICE_DETAIL_KEYS = ["subServiceCode", "subService", "changeType", "visaType", "visaOption"] as const;

/**
 * Lead where-clause for one SubService: the lead's service plus any details key holding the code
 * (as stored, upper-case, or with spaces), the sub-service's name, or details.subServiceId.
 */
export function subServiceLeadWhere(row: SubServiceFilterRow): Prisma.LeadWhereInput {
  const variants = [...new Set([row.code, row.code.toUpperCase(), row.code.replace(/_/g, " "), row.name])];
  const or: Prisma.LeadWhereInput[] = [{ details: { path: ["subServiceId"], equals: row.id } }];
  for (const key of SUB_SERVICE_DETAIL_KEYS) {
    for (const variant of variants) or.push({ details: { path: [key], equals: variant } });
  }
  return { AND: [{ serviceType: row.serviceType }, { OR: or }] };
}

/** Booking-level conditions (booking status, payment status) - pure, no DB access. */
export function bookingLevelWhere(filters: Pick<ReportFilters, "bookingStatus" | "paymentStatus">): Prisma.BookingWhereInput[] {
  const and: Prisma.BookingWhereInput[] = [];
  if (filters.bookingStatus) and.push({ status: filters.bookingStatus });
  if (filters.paymentStatus === "PAID") and.push({ payments: { some: { status: "SUCCESS" } } });
  if (filters.paymentStatus === "UNPAID") and.push({ payments: { none: { status: "SUCCESS" } } });
  if (filters.paymentStatus === "REFUNDED") and.push({ payments: { some: { refunds: { some: { status: "COMPLETED" } } } } });
  return and;
}

/** True when any filter narrows by lead/booking (so company-wide figures such as expenses don't fit). */
export function hasRecordScope(filters: ReportFilters): boolean {
  return Boolean(
    filters.serviceType ||
      filters.countryId ||
      filters.staffId ||
      filters.vendorId ||
      filters.subService ||
      filters.leadStatus ||
      filters.bookingStatus ||
      filters.paymentStatus
  );
}

/** Lead-only conditions (no booking-level filters). */
async function leadOnlyConditions(filters: ReportFilters): Promise<Prisma.LeadWhereInput[]> {
  const and: Prisma.LeadWhereInput[] = [];
  if (filters.serviceType) and.push({ serviceType: filters.serviceType });
  if (filters.staffId) and.push({ assignedStaffId: filters.staffId });
  if (filters.vendorId) and.push({ quotations: { some: { isSelected: true, vendorId: filters.vendorId } } });
  if (filters.leadStatus) and.push({ status: filters.leadStatus });
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
  if (filters.subService) {
    const parsed = parseSubServiceFilter(filters.subService);
    const row = parsed
      ? await db.subService.findUnique({
          where: { serviceType_code: { serviceType: parsed.serviceType, code: parsed.code } },
          select: { id: true, serviceType: true, code: true, name: true },
        })
      : null;
    and.push(row ? subServiceLeadWhere(row) : { id: "__no_such_sub_service__" });
  }
  return and;
}

export async function leadScopeWhere(filters: ReportFilters): Promise<Prisma.LeadWhereInput> {
  const and = await leadOnlyConditions(filters);
  const bookingLevel = bookingLevelWhere(filters);
  if (bookingLevel.length) and.push({ bookings: { some: { AND: bookingLevel } } });
  return and.length ? { AND: and } : {};
}

/** Same scope for Booking queries: the lead filters through the booking's lead, booking-level filters on the booking itself. */
export async function bookingScopeWhere(filters: ReportFilters): Promise<Prisma.BookingWhereInput> {
  const leadAnd = await leadOnlyConditions(filters);
  const and: Prisma.BookingWhereInput[] = [];
  if (leadAnd.length) and.push({ lead: { AND: leadAnd } });
  and.push(...bookingLevelWhere(filters));
  return and.length ? { AND: and } : {};
}

/** Same scope for Payment queries (through payment -> booking). */
export async function paymentScopeWhere(filters: ReportFilters): Promise<Prisma.PaymentWhereInput> {
  const booking = await bookingScopeWhere(filters);
  return Object.keys(booking).length ? { booking } : {};
}

/** Same scope for Refund queries (through refund -> payment -> booking). */
export async function refundScopeWhere(filters: ReportFilters): Promise<Prisma.RefundWhereInput> {
  const payment = await paymentScopeWhere(filters);
  return Object.keys(payment).length ? { payment } : {};
}

export const round2 = (value: number) => Math.round(value * 100) / 100;
