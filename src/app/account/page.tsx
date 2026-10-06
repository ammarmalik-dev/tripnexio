import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { db } from "@/lib/db";
import { leadReference } from "@/lib/leads/reference";
import { customerStatusLabel } from "@/lib/service-status/customer-label";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: "My Bookings",
  description: "Your TripNexio requests and bookings.",
  robots: { index: false, follow: false },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Client corrections 2026-10-05 — My Bookings: each booking opens its own detail (status, documents, invoices); open requests below. */
export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) return null;

  const [bookings, openLeads] = await Promise.all([
    db.booking.findMany({
      where: { customerId: session.id, status: { not: "PENDING" } },
      include: { lead: { select: { serviceType: true } }, serviceStatus: { select: { customerLabel: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Requests that haven't become a paid booking yet.
    db.lead.findMany({
      where: { customerId: session.id, bookings: { none: { status: { not: "PENDING" } } }, status: { notIn: ["LOST", "CLOSED", "CONVERTED"] } },
      orderBy: { createdAt: "desc" },
      include: { serviceStatus: { select: { customerLabel: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-heading">My Bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="Once a request is confirmed and paid, it shows up here."
            action={<ButtonLink href="/services">Browse Services</ButtonLink>}
          />
        ) : (
          bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/account/bookings/${booking.id}`}
              className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4 transition-shadow hover:shadow-[0_8px_20px_rgb(24_42_77/0.08)]"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[booking.lead.serviceType]}</span>
                <span className="text-xs text-ink-tertiary">
                  {booking.bookingId} · {formatDate(booking.createdAt)}
                </span>
              </div>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  {customerStatusLabel("BOOKING", booking.serviceStatus, booking.status)}
                </span>
                <ChevronRight className="h-4 w-4 text-ink-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))
        )}
      </section>

      {openLeads.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink-heading">Open Requests</h2>
          {openLeads.map((lead) => (
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
          ))}
        </section>
      ) : null}
    </div>
  );
}
