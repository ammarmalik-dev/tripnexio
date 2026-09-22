import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { db } from "@/lib/db";
import { formatLeadReference } from "@/lib/leads/reference";
import { CUSTOMER_LEAD_STATUS_LABELS, CUSTOMER_BOOKING_STATUS_LABELS } from "@/lib/account/labels";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { InfoPage } from "@/components/layout/InfoPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoutButton } from "@/components/auth/LogoutButton";

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

  const [leads, bookings] = await Promise.all([
    db.lead.findMany({ where: { customerId: session.id }, orderBy: { createdAt: "desc" } }),
    db.booking.findMany({
      where: { customerId: session.id },
      include: { lead: { select: { serviceType: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <InfoPage
      eyebrow="My Account"
      title={`Welcome back, ${session.name.split(" ")[0]}`}
      description="Every request and booking you've made with TripNexio, in one place."
    >
      <div className="flex justify-end">
        <LogoutButton />
      </div>

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
                  {formatLeadReference(lead.serviceType, lead.id)} · {formatDate(lead.createdAt)}
                </span>
              </div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-ink-accent">
                {CUSTOMER_LEAD_STATUS_LABELS[lead.status]}
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
          bookings.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-heading">{booking.bookingId}</span>
                <span className="text-xs text-ink-tertiary">
                  {SERVICE_TYPE_LABELS[booking.lead.serviceType]} · {formatDate(booking.createdAt)}
                </span>
              </div>
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                {CUSTOMER_BOOKING_STATUS_LABELS[booking.status]}
              </span>
            </div>
          ))
        )}
      </section>
    </InfoPage>
  );
}
