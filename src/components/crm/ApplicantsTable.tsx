"use client";

import type { ApplicantRow } from "@/lib/new-visa/applicants";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const PAX_LABELS: Record<string, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };
const RELATIONSHIP_LABELS: Record<string, string> = { FATHER: "Father", MOTHER: "Mother" };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** P11 — every applicant on a request: passport, DOB, occupation, passenger type and (for a minor) the guardian. */
export function ApplicantsTable({ applicants }: { applicants: ApplicantRow[] }) {
  // A large group request can list many applicants; the pager only appears past one default page.
  const { pageItems, paginationProps } = useClientPagination(applicants);
  if (applicants.length === 0) return <p className="text-sm text-ink-tertiary">No applicants recorded.</p>;
  const hasGuardian = applicants.some((a) => a.guardianName);
  return (
    <div className="flex flex-col gap-3">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-ink-tertiary">
          <tr className="border-b border-hairline">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium">Passport</th>
            <th className="py-2 pr-3 font-medium">DOB</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 font-medium">Occupation</th>
            {hasGuardian ? <th className="py-2 pr-3 font-medium">Guardian</th> : null}
          </tr>
        </thead>
        <tbody>
          {pageItems.map((applicant, index) => (
            <tr key={applicant.passengerId ?? `row-${index}-${applicant.fullName}`} className="border-b border-hairline last:border-b-0 align-top hover:bg-ink-primary/[0.02]">
              <td className="py-2 pr-3 font-medium text-ink-primary">{applicant.fullName || "—"}</td>
              <td className="py-2 pr-3 text-ink-secondary">
                {applicant.passportNumber ?? "—"}
                {applicant.passportExpiry ? <span className="block text-xs text-ink-tertiary">expires {formatDate(applicant.passportExpiry)}</span> : null}
              </td>
              <td className="py-2 pr-3 text-ink-secondary">{formatDate(applicant.dob)}</td>
              <td className="py-2 pr-3 text-ink-secondary">{applicant.paxType ? PAX_LABELS[applicant.paxType] : "—"}</td>
              <td className="py-2 pr-3 text-ink-secondary">{applicant.occupation ?? "—"}</td>
              {hasGuardian ? (
                <td className="py-2 pr-3 text-ink-secondary">
                  {applicant.guardianName ? (
                    <>
                      {applicant.guardianName}
                      <span className="block text-xs text-ink-tertiary">
                        {applicant.guardianPassport ?? "—"}
                        {applicant.guardianRelationship ? ` · ${RELATIONSHIP_LABELS[applicant.guardianRelationship] ?? applicant.guardianRelationship}` : ""}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {applicants.length > DEFAULT_PAGE_SIZE ? <ListPagination noun="applicant" {...paginationProps} /> : null}
    </div>
  );
}
