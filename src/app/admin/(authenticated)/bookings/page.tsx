import type { Metadata } from "next";
import { AdminBookingsExplorer } from "@/components/admin/AdminBookingsExplorer";

export const metadata: Metadata = { title: "Bookings | Admin" };

export default function AdminBookingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Bookings</h1>
        <p className="text-sm text-ink-tertiary">
          Read-only search across every booking — filter by customer, service, destination country, assigned staff, vendor, status, and
          latest payment. Open a booking to act on it in the CRM.
        </p>
      </div>
      <AdminBookingsExplorer />
    </div>
  );
}
