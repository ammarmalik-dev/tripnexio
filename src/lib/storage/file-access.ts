import { db } from "../db";
import { getStaffSession } from "../auth/staff-session";
import { getCustomerSession } from "../auth/get-customer-session";
import { hasPermission } from "../auth/permissions";
import { hasServiceAccess, isServiceScopeUnrestricted } from "../auth/service-scope";

const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

/**
 * Decides whether the current request may read a stored `/api/files/<id>`
 * file. Access is derived from the records that reference the file:
 * - a staff session with documents.view (payments.view for bank slips) and
 *   service scope over the related lead/booking; invoice branding files are
 *   readable by any signed-in staff user;
 * - a customer session that owns the related booking or passenger;
 * - a valid pay/quote token (`?token=`) tied to the related booking or lead.
 * A file referenced by nothing is never served.
 */
export async function canAccessStoredFile(fileUrl: string, token: string | null): Promise<boolean> {
  const [documents, slipPayments, invoiceConfig] = await Promise.all([
    db.document.findMany({
      where: { fileUrl },
      select: {
        bookingId: true,
        passengerId: true,
        booking: { select: { customerId: true, customerToken: true, lead: { select: { serviceType: true, customerToken: true } } } },
        passenger: { select: { customerId: true } },
      },
    }),
    db.payment.findMany({
      where: { bankSlipUrl: fileUrl },
      select: { booking: { select: { customerId: true, customerToken: true, lead: { select: { serviceType: true, customerToken: true } } } } },
    }),
    db.invoiceConfig.findFirst({ where: { OR: [{ companyLogoUrl: fileUrl }, { signatureImageUrl: fileUrl }] }, select: { id: true } }),
  ]);
  if (documents.length === 0 && slipPayments.length === 0 && !invoiceConfig) return false;

  const staff = await getStaffSession();
  if (staff) {
    if (invoiceConfig) return true;
    if (slipPayments.some((payment) => hasPermission(staff, "payments.view") && hasServiceAccess(staff, payment.booking.lead.serviceType))) return true;
    if (hasPermission(staff, "documents.view")) {
      for (const document of documents) {
        if (document.booking) {
          if (hasServiceAccess(staff, document.booking.lead.serviceType)) return true;
        } else if (document.passenger) {
          if (isServiceScopeUnrestricted(staff)) return true;
          const leads = await db.lead.findMany({ where: { customerId: document.passenger.customerId }, select: { serviceType: true } });
          if (leads.some((lead) => hasServiceAccess(staff, lead.serviceType))) return true;
        }
      }
    }
  }

  const customer = await getCustomerSession();
  if (customer) {
    if (documents.some((document) => document.booking?.customerId === customer.id || document.passenger?.customerId === customer.id)) return true;
    if (slipPayments.some((payment) => payment.booking.customerId === customer.id)) return true;
  }

  if (token && TOKEN_PATTERN.test(token)) {
    const tokenMatches = (booking: { customerToken: string | null; lead: { customerToken: string | null } } | null) =>
      Boolean(booking && (booking.customerToken === token || booking.lead.customerToken === token));
    if (documents.some((document) => tokenMatches(document.booking))) return true;
    if (slipPayments.some((payment) => tokenMatches(payment.booking))) return true;

    const passengerIds = documents.map((document) => document.passengerId).filter((id): id is string => Boolean(id));
    if (passengerIds.length > 0) {
      const tokenBooking = await db.booking.count({
        where: { customerToken: token, passengers: { some: { passengerId: { in: passengerIds } } } },
      });
      if (tokenBooking > 0) return true;
    }
  }

  return false;
}
