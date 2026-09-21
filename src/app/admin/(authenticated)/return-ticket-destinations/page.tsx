import type { Metadata } from "next";
import { ReturnTicketDestinationsManager } from "@/components/admin/ReturnTicketDestinationsManager";

export const metadata: Metadata = { title: "Return Ticket Destinations | Admin" };

export default function AdminReturnTicketDestinationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Return Ticket Destinations</h1>
        <p className="text-sm text-ink-tertiary">
          Choose which countries customers can request a Return Verified Ticket for, set the rate per applicant, and
          pick the visa-validity options (30 / 60 / 90 days) offered for each. Changes apply to the website form
          immediately.
        </p>
      </div>
      <ReturnTicketDestinationsManager />
    </div>
  );
}
