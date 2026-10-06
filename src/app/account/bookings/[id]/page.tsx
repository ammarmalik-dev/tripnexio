import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Search } from "lucide-react";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { db } from "@/lib/db";
import { leadReference } from "@/lib/leads/reference";
import { customerStatusLabel } from "@/lib/service-status/customer-label";
import { customerPassengerStatuses } from "@/lib/protection-plan/customer-passenger-statuses";
import { showPostTicketOffer } from "@/lib/cross-sell/post-ticket";
import { OUTPUT_TYPES, OUTPUT_TYPE_LABELS, type OutputType } from "@/lib/outputs/output-types";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { formatCurrency } from "@/lib/format-currency";
import { PostTicketOfferCard } from "@/components/cross-sell/PostTicketOfferCard";

export const metadata: Metadata = { title: "Booking Details", robots: { index: false, follow: false } };

interface AccountBookingPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Client corrections 2026-10-05 — one booking in the customer portal:
 * status, travellers, delivered documents and invoices. Only the signed-in
 * customer's own booking is shown (anyone else's id is a 404).
 */
export default async function AccountBookingPage({ params }: AccountBookingPageProps) {
  const session = await getCustomerSession();
  if (!session) notFound();
  const { id } = await params;

  const booking = await db.booking.findFirst({
    where: { id, customerId: session.id, status: { not: "PENDING" } },
    include: {
      lead: { select: { serviceType: true, crossSellOptOut: true, reference: true, createdAt: true, id: true, travelDate: true } },
      serviceStatus: { select: { customerLabel: true, systemEvent: true } },
      linkedBooking: { select: { lead: { select: { serviceType: true } } } },
      payments: { where: { status: "SUCCESS" }, orderBy: { updatedAt: "desc" }, select: { id: true, invoiceNumber: true, updatedAt: true, amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true } },
      documents: {
        // P27 - purged files stay listed as "Deleted after retention period".
        where: { type: { in: [...OUTPUT_TYPES] }, deliveredAt: { not: null }, OR: [{ fileUrl: { not: null } }, { purgedAt: { not: null } }] },
        orderBy: { deliveredAt: "desc" },
        select: { id: true, type: true, fileUrl: true, purgedAt: true, deliveredAt: true, passenger: { select: { fullName: true } } },
      },
    },
  });
  if (!booking) notFound();

  const passengers = await customerPassengerStatuses(booking.id);
  const serviceLabel = SERVICE_TYPE_LABELS[booking.lead.serviceType];
  const status = customerStatusLabel("BOOKING", booking.serviceStatus, booking.status);
  const ticketDelivered = booking.documents.some((document) => document.type === "TICKET_PDF");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/account" className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-secondary hover:text-ink-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        My Bookings
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-hairline bg-surface-1 p-6">
        <div>
          <p className="text-sm text-ink-tertiary">{serviceLabel}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">{booking.bookingId}</h2>
          <p className="mt-1 text-xs text-ink-tertiary">
            Booked {formatDate(booking.createdAt)}
            {booking.lead.travelDate ? ` · Travel ${formatDate(booking.lead.travelDate)}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">{status}</span>
          <Link href="/track" className="inline-flex items-center gap-1 text-xs font-medium text-ink-accent hover:underline">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Track Status (reference {leadReference(booking.lead)})
          </Link>
        </div>
        {booking.visaRejectionReason ? <p className="w-full text-sm text-error">Reason: {booking.visaRejectionReason}</p> : null}
        {booking.lead.serviceType === "OTB" && booking.serviceStatus?.systemEvent === "OTB_APPROVED" && booking.pnr ? (
          <p className="w-full text-sm text-ink-secondary">
            <span className="font-medium text-ink-primary">OTB PNR / reference:</span> {booking.pnr}
          </p>
        ) : null}
      </section>

      {passengers.length > 0 ? (
        <section className="rounded-2xl border border-hairline bg-surface-1 p-6">
          <h3 className="text-base font-semibold text-ink-heading">Travellers</h3>
          <ul className="mt-3 flex flex-col divide-y divide-hairline">
            {passengers.map((passenger, index) => (
              <li key={`${passenger.name}-${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="font-medium text-ink-primary">{passenger.name}</span>
                <span className="text-ink-secondary">
                  {passenger.visaStatus}
                  {passenger.protectionPlan ? ` · Protection Plan: ${passenger.protectionPlan}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-hairline bg-surface-1 p-6">
        <h3 className="text-base font-semibold text-ink-heading">Your Documents</h3>
        {booking.documents.length === 0 ? (
          <p className="mt-2 text-sm text-ink-tertiary">Your visa, ticket or confirmation appears here as soon as it&apos;s ready.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-hairline">
            {booking.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-ink-primary">
                    {OUTPUT_TYPE_LABELS[document.type as OutputType]}
                    {document.passenger ? ` — ${document.passenger.fullName}` : ""}
                  </span>
                  <span className="text-xs text-ink-tertiary">Delivered {formatDate(document.deliveredAt as Date)}</span>
                </span>
                {document.fileUrl ? (
                  <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-ink-accent hover:bg-accent/20">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download
                  </a>
                ) : (
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-tertiary">Deleted after retention period</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface-1 p-6">
        <h3 className="text-base font-semibold text-ink-heading">Invoices</h3>
        {booking.payments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-tertiary">No invoices yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-hairline">
            {booking.payments.map((payment) => {
              const total = Number(payment.amount) - Number(payment.couponDiscount ?? 0) + Number(payment.gstAmount) + Number(payment.gatewayFee);
              return (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-ink-primary">
                    <FileText className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
                    {payment.invoiceNumber ?? "Invoice"} · {formatCurrency(total)} · {formatDate(payment.updatedAt)}
                  </span>
                  <a href={`/api/account/invoices/${payment.id}`} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-ink-accent hover:bg-accent/20">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download invoice
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {booking.customerToken &&
      showPostTicketOffer({ serviceType: booking.lead.serviceType, crossSellOptOut: booking.lead.crossSellOptOut, documentTypes: ticketDelivered ? ["TICKET_PDF"] : [] }) ? (
        <PostTicketOfferCard bookingToken={booking.customerToken} />
      ) : null}
      {booking.lead.serviceType === "OTB" && booking.serviceStatus?.systemEvent === "OTB_APPROVED" && booking.linkedBooking?.lead.serviceType !== "RETURN_TICKET" ? (
        <p className="text-sm text-ink-secondary">
          Need a return ticket?{" "}
          <Link href="/services/return-ticket" className="text-ink-accent underline">
            Get a Return Verified Ticket
          </Link>
        </p>
      ) : null}
    </div>
  );
}
