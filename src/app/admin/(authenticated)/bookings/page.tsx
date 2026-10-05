import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingsTable } from "@/components/crm/BookingsTable";

export const metadata: Metadata = { title: "Bookings | Admin" };

/** Client corrections 2026-10-05: the same full operational table as the CRM; bookings open inside Admin. */
export default function AdminBookingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Bookings</h1>
        <p className="text-sm text-ink-tertiary">Every paid booking across services, with operational filters.</p>
      </div>
      <Suspense>
        <BookingsTable detailBasePath="/admin/bookings" />
      </Suspense>
    </div>
  );
}
