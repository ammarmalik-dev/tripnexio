import type { Metadata } from "next";
import { BookingsTable } from "@/components/crm/BookingsTable";

export const metadata: Metadata = { title: "Bookings | Internal Dashboard" };

export default function CrmBookingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Bookings</h1>
        <p className="text-sm text-ink-tertiary">Every booking created from a selected quotation.</p>
      </div>
      <BookingsTable />
    </div>
  );
}
