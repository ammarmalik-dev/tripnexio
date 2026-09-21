import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

export interface PriorVisaMatchItem {
  passengerId: string;
  fullName: string;
  passportNumber: string;
  match: {
    leadId: string;
    referenceId: string;
    createdAt: string;
    bookingId: string | null;
    destinationCountry: string | null;
    visaType: string | null;
    travelDate: string | null;
  } | null;
}

/**
 * Per-applicant result of checking each passport number against existing
 * TripNexio records (Visa Extension handover doc). Read-only: if there's no
 * match, staff follow the configured eligibility/rejection process.
 */
export function VisaExtensionPriorVisaPanel({
  items,
  visaExpiryByPassport,
}: {
  items: PriorVisaMatchItem[];
  visaExpiryByPassport: Record<string, string>;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-heading">Previous TripNexio Visa Check</h2>
      <p className="mb-3 text-xs text-ink-tertiary">
        Each applicant&apos;s passport number is checked against existing TripNexio records.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-tertiary">No applicants with a passport number on this request.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.passengerId} className="rounded-lg border border-hairline bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-primary">
                  {item.fullName} · {item.passportNumber}
                </span>
                {visaExpiryByPassport[item.passportNumber] ? (
                  <span className="text-xs text-ink-tertiary">
                    Stated expiry: {visaExpiryByPassport[item.passportNumber]}
                  </span>
                ) : null}
              </div>
              {item.match ? (
                <div className="mt-2 flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Previously received a visa through TripNexio</span>
                    <span className="text-xs text-ink-secondary">
                      <Link href={`/crm/leads/${item.match.leadId}`} className="text-ink-accent underline">
                        {item.match.referenceId}
                      </Link>
                      {item.match.bookingId ? ` · Booking ${item.match.bookingId}` : ""}
                      {item.match.destinationCountry ? ` · ${item.match.destinationCountry}` : ""}
                      {item.match.visaType ? ` · ${item.match.visaType}` : ""}
                      {item.match.travelDate ? ` · Travel ${item.match.travelDate}` : ""}
                      {` · Requested ${new Date(item.match.createdAt).toLocaleDateString("en-IN")}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-start gap-2 text-sm text-error">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">No previous TripNexio visa found</span>
                    <span className="text-xs text-ink-secondary">
                      Follow the configured eligibility and rejection process for this applicant.
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
