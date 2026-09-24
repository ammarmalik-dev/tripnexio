import { Download } from "lucide-react";

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
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-white/[0.03]"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Export CSV
    </a>
  );
}
