import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getReport } from "@/lib/reports/registry";
import { getSystemConfig } from "@/lib/settings/system-config";
import { ReportViewer } from "@/components/admin/reports/ReportViewer";

interface PageProps {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const report = getReport(key);
  return { title: `${report ? report.title : "Report"} | Admin` };
}

/** P25 — generic viewer for one registered Finance / MIS report. */
export default async function AdminReportPage({ params }: PageProps) {
  const { key } = await params;
  const report = getReport(key);
  if (!report) notFound();
  const { currencyCode } = await getSystemConfig();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/reports" className="inline-flex w-fit items-center gap-1 text-xs text-ink-tertiary hover:text-ink-primary">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All reports
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-accent">{report.group === "finance" ? "Finance" : "MIS"}</p>
          <h1 className="text-xl font-semibold text-ink-heading">{report.title}</h1>
          <p className="text-sm text-ink-tertiary">{report.description}</p>
        </div>
      </div>
      <ReportViewer reportKey={report.key} supportedFilters={report.supportedFilters} currencyCode={currencyCode} />
    </div>
  );
}
