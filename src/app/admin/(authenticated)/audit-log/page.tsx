import type { Metadata } from "next";
import { BookingQuickSearch } from "@/components/crm/BookingQuickSearch";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

export const metadata: Metadata = { title: "Audit Log | Admin" };

export default function AdminAuditLogPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Client doc 16 Nov (K4) — quick booking search beside the heading. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-heading">Audit Log</h1>
          <p className="text-sm text-ink-tertiary">
            Every recorded change across the system — who did what, to which record, and when. Rows with no user were made by the system
            (webhooks, automation, customer actions).
          </p>
        </div>
        <BookingQuickSearch basePath="/admin/bookings" />
      </div>
      <AuditLogViewer />
    </div>
  );
}
