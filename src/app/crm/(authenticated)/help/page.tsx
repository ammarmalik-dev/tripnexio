import type { Metadata } from "next";
import Link from "next/link";
import { Mail, LifeBuoy, Compass } from "lucide-react";
import { getSystemConfig } from "@/lib/settings/system-config";
import { HelpSearch } from "@/components/crm/help/HelpSearch";
import { ReportIssueForm } from "@/components/crm/help/ReportIssueForm";

export const metadata: Metadata = { title: "Help | Internal Dashboard" };

/** Short "CRM usage guidance" (CRM.md §28) — pointers to screens that exist today, nothing invented. */
const HOW_TO_LINKS: { label: string; href: string; description: string }[] = [
  { label: "Work a new lead", href: "/crm/leads", description: "Open a lead, set its status, build a quote and create the booking." },
  { label: "Follow up on tasks", href: "/crm/tasks", description: "Pick up open tasks, assign them, and mark them done." },
  { label: "Review documents", href: "/crm/documents", description: "Verify, reject or flag missing customer documents." },
  { label: "Your profile & password", href: "/crm/profile", description: "Change your password and set a security question." },
];

/**
 * P22 item 2 — CRM.md §28 Help / Need Help: search (Knowledge Centre + FAQs),
 * contact admin, report an issue, and brief usage guidance. Open to every
 * signed-in staff member (the (authenticated) layout already enforces that).
 */
export default async function CrmHelpPage() {
  const config = await getSystemConfig();
  const adminEmail = config.systemAlertEmail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Help</h1>
        <p className="text-sm text-ink-tertiary">Search the Knowledge Centre and FAQs, contact an admin, or report a problem.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="help-search-heading">
            <h2 id="help-search-heading" className="mb-3 text-sm font-semibold text-ink-heading">
              Search help
            </h2>
            <HelpSearch />
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="report-issue-heading">
            <h2 id="report-issue-heading" className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-heading">
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Report an issue
            </h2>
            <p className="mb-4 text-xs text-ink-tertiary">
              Your report becomes a support task that admins see on the Tasks screen.
            </p>
            <ReportIssueForm />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="contact-admin-heading">
            <h2 id="contact-admin-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-heading">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact admin
            </h2>
            {adminEmail ? (
              <p className="text-sm text-ink-secondary">
                Email{" "}
                <a href={`mailto:${adminEmail}`} className="font-medium text-ink-accent hover:underline">
                  {adminEmail}
                </a>{" "}
                for access, account or configuration questions.
              </p>
            ) : (
              <p className="text-sm text-ink-secondary">
                For access, account or configuration questions, contact your admin directly, or use the report form — it reaches the admin team.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="how-to-heading">
            <h2 id="how-to-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-heading">
              <Compass className="h-4 w-4" aria-hidden="true" />
              Using the CRM
            </h2>
            <ul className="flex flex-col gap-3">
              {HOW_TO_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm font-medium text-ink-accent hover:underline">
                    {item.label}
                  </Link>
                  <p className="text-xs text-ink-tertiary">{item.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
