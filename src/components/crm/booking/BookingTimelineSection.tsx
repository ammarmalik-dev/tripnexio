import { LeadTimeline } from "../LeadTimeline";

export interface BookingTimelineEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  note: string | null;
  timestamp: string;
  byUser: { name: string } | null;
}

/** CRM.md §36 — the booking's full activity (booking, lead, quotations, payments/refunds, documents), oldest first. */
export function BookingTimelineSection({ entries, truncated }: { entries: BookingTimelineEntry[]; truncated: boolean }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Activity Timeline</h2>
        <span className="text-xs text-ink-tertiary">
          {truncated ? `Showing the latest ${entries.length} entries` : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        </span>
      </div>
      <LeadTimeline entries={entries} />
    </section>
  );
}
