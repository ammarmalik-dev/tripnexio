import { Download } from "lucide-react";
import { MAX_EXPORT_ROWS } from "@/lib/csv/export-limits";

/**
 * Step 54 — a plain native `<a href>` (not Link/Button-as-link), same
 * reasoning as Phase 4D's DataExportPanel: a real anchor is what triggers
 * the browser's normal file-download behavior for a
 * `Content-Disposition: attachment` CSV response.
 */
export function ExportCsvButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      title={`Exports up to ${MAX_EXPORT_ROWS.toLocaleString("en-IN")} rows matching the current filters`}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-white/[0.03]"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Export CSV
    </a>
  );
}
