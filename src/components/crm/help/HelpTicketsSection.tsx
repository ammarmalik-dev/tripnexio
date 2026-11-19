"use client";

import { useState } from "react";
import { LifeBuoy, Ticket } from "lucide-react";
import { ReportIssueForm } from "./ReportIssueForm";
import { SupportTicketsPanel } from "./SupportTicketsPanel";

/** Client doc 16 Nov (L3) — Report an issue (raises a TNIT ticket) and the staff member's own tickets, refreshed together. */
export function HelpTicketsSection({ initialTicketId }: { initialTicketId?: string | null }) {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <>
      <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="report-issue-heading">
        <h2 id="report-issue-heading" className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-heading">
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          Report an issue
        </h2>
        <p className="mb-4 text-xs text-ink-tertiary">Your report becomes a support ticket for the admin team; you get its number and a confirmation email.</p>
        <ReportIssueForm onCreated={() => setReloadKey((key) => key + 1)} />
      </section>
      <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="my-tickets-heading">
        <h2 id="my-tickets-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-heading">
          <Ticket className="h-4 w-4" aria-hidden="true" />
          My tickets
        </h2>
        <SupportTicketsPanel scope="mine" reloadKey={reloadKey} initialTicketId={initialTicketId ?? null} />
      </section>
    </>
  );
}
