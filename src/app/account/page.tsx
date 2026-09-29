import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { db } from "@/lib/db";
import { leadReference } from "@/lib/leads/reference";
import { customerStatusLabel } from "@/lib/service-status/customer-label";
import { customerPassengerStatuses } from "@/lib/protection-plan/customer-passenger-statuses";
import { showPostTicketOffer } from "@/lib/cross-sell/post-ticket";
import { PostTicketOfferCard } from "@/components/cross-sell/PostTicketOfferCard";
import { OUTPUT_TYPES, OUTPUT_TYPE_LABELS, type OutputType } from "@/lib/outputs/output-types";
import { getOutstandingDocuments } from "@/lib/account/outstanding-documents";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { InfoPage } from "@/components/layout/InfoPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AccountDocumentsSection } from "@/components/account/AccountDocumentsSection";

export const metadata: Metadata = {
  title: "My Account",
  description: "Your TripNexio requests and bookings.",
  robots: { index: false, follow: false },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const [leads, bookings, outstandingDocuments, deliveredDocuments] = await Promise.all([
    db.lead.findMany({
      where: { customerId: session.id },
      orderBy: { createdAt: "desc" },
      include: { serviceStatus: { select: { customerLabel: true } } },
    }),
    db.booking.findMany({
      where: { customerId: session.id },
      include: {
        lead: { select: { serviceType: true, crossSellOptOut: true } },
        serviceStatus: { select: { customerLabel: true } },
        documents: { where: { type: "TICKET_PDF", deliveredAt: { not: null } }, select: { type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getOutstandingDocuments(session.id),
    // P09 — the service results TripNexio delivered (visa, ticket, package...).
    db.document.findMany({
      where: { booking: { customerId: session.id }, type: { in: [...OUTPUT_TYPES] }, deliveredAt: { not: null }, fileUrl: { not: null } },
      orderBy: { deliveredAt: "desc" },
      select: { id: true, type: true, fileUrl: true, deliveredAt: true, passenger: { select: { fullName: true } }, booking: { select: { bookingId: true } } },
    }),
  ]);
  // P12 — New Visa: each passenger's visa status beside their Protection Plan status.
  const passengerStatusesByBooking = await Promise.all(bookings.map((booking) => customerPassengerStatuses(booking.id)));

  return (
    <InfoPage
      eyebrow="My Account"
      title={`Welcome back, ${session.name.split(" ")[0]}`}
      description="Every request and booking you've made with TripNexio, in one place."
    >
      <div className="flex justify-end">
        <LogoutButton />
      </div>

      <AccountDocumentsSection documents={outstandingDocuments} />

      {deliveredDocuments.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink-heading">Your Documents</h2>
          {deliveredDocuments.map((document) => (
            <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-heading">
                  {OUTPUT_TYPE_LABELS[document.type as OutputType]}
                  {document.passenger ? ` — ${document.passenger.fullName}` : ""}
                </span>
                <span className="text-xs text-ink-tertiary">
                  {document.booking?.bookingId} · delivered {formatDate(document.deliveredAt as Date)}
                </span>
              </div>
              <a
                href={document.fileUrl as string}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-ink-accent hover:bg-accent/20"
              >
                Download
              </a>
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-heading">My Requests</h2>
        {leads.length === 0 ? (
          <EmptyState title="No requests yet" description="Once you submit a service request, it'll show up here." />
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[lead.serviceType]}</span>
                <span className="text-xs text-ink-tertiary">
                  {leadReference(lead)} · {formatDate(lead.createdAt)}
                </span>
              </div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-ink-accent">
                {customerStatusLabel("LEAD", lead.serviceStatus, lead.status)}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-heading">My Bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState title="No bookings yet" description="Once a request is confirmed and paid, it'll show up here." />
        ) : (
          bookings.map((booking, bookingIndex) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-heading">{booking.bookingId}</span>
                <span className="text-xs text-ink-tertiary">
                  {SERVICE_TYPE_LABELS[booking.lead.serviceType]} · {formatDate(booking.createdAt)}
                </span>
              </div>
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                {customerStatusLabel("BOOKING", booking.serviceStatus, booking.status)}
              </span>
              {booking.visaRejectionReason ? (
                <p className="w-full text-xs text-error">Reason: {booking.visaRejectionReason}</p>
              ) : null}
              {passengerStatusesByBooking[bookingIndex].length > 0 ? (
                <ul className="w-full border-t border-hairline pt-2">
                  {passengerStatusesByBooking[bookingIndex].map((passenger, index) => (
                    <li key={`${passenger.name}-${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1 text-xs">
                      <span className="font-medium text-ink-primary">{passenger.name}</span>
                      <span className="text-ink-secondary">
                        Visa: {passenger.visaStatus}
                        {passenger.protectionPlan ? ` · Protection Plan: ${passenger.protectionPlan}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {booking.customerToken &&
              showPostTicketOffer({
                serviceType: booking.lead.serviceType,
                crossSellOptOut: booking.lead.crossSellOptOut,
                documentTypes: booking.documents.map((document) => document.type),
              }) ? (
                <div className="w-full">
                  <PostTicketOfferCard bookingToken={booking.customerToken} />
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>
    </InfoPage>
  );
}
