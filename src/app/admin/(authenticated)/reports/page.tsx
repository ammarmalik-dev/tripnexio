import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Gauge, TrendingUp, Undo2 } from "lucide-react";
import { REPORTS } from "@/lib/reports/registry";
import type { ReportDefinition, ReportFilterKey } from "@/lib/reports/types";

export const metadata: Metadata = { title: "Finance & MIS Reports | Admin" };

const FILTER_LABELS: Record<ReportFilterKey, string> = {
  serviceType: "Service",
  countryId: "Country",
  staffId: "Staff",
  vendorId: "Vendor",
};

const DASHBOARDS = [
  {
    label: "Management Dashboard",
    href: "/admin/reports/management",
    icon: Gauge,
    description: "Sales to Net Profit waterfall, GST liability and net cash movement, vs the previous period.",
  },
  { label: "P&L Report", href: "/admin/pnl-report", icon: TrendingUp, description: "Revenue, vendor cost, margin and expenses by category." },
  { label: "Revenue Report", href: "/admin/revenue-report", icon: BarChart3, description: "Revenue from successful payments." },
  { label: "Refund Report", href: "/admin/refund-report", icon: Undo2, description: "Refunds and the charges retained." },
];

const cardClass =
  "group flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-5 transition-colors hover:border-glass-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function ReportCard({ report }: { report: ReportDefinition }) {
  const filters = report.supportedFilters.map((key) => FILTER_LABELS[key]);
  return (
    <Link href={`/admin/reports/${report.key}`} className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-heading">{report.title}</h3>
        <ArrowRight className="h-4 w-4 shrink-0 text-ink-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <p className="text-xs text-ink-tertiary">{report.description}</p>
      <p className="text-[11px] text-ink-muted">Filters: date range{filters.length ? `, ${filters.join(", ")}` : ""}</p>
    </Link>
  );
}

function ReportGroup({ id, title, reports }: { id: string; title: string; reports: ReportDefinition[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">
        {title}
      </h2>
      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-5 text-sm text-ink-tertiary">No {title} reports are registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <ReportCard key={report.key} report={report} />
          ))}
        </div>
      )}
    </section>
  );
}

/** P25 (Locked Business Rules v2.0 §15) — every registered Finance / MIS report, plus the dedicated report screens. */
export default function AdminReportsIndexPage() {
  const finance = REPORTS.filter((report) => report.group === "finance");
  const mis = REPORTS.filter((report) => report.group === "mis");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Finance &amp; MIS Reports</h1>
        <p className="text-sm text-ink-tertiary">
          Every report filters by date range (and by service, country, staff or vendor where it applies) and exports to CSV. Figures
          include vendor cost and margin, so these screens are Admin-only.
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="reports-dashboards">
        <h2 id="reports-dashboards" className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">
          Dashboards
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {DASHBOARDS.map(({ label, href, icon: Icon, description }) => (
            <Link key={href} href={href} className={cardClass}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-ink-accent" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-ink-heading">{label}</h3>
              </div>
              <p className="text-xs text-ink-tertiary">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <ReportGroup id="reports-finance" title="Finance" reports={finance} />
      <ReportGroup id="reports-mis" title="MIS" reports={mis} />
    </div>
  );
}
