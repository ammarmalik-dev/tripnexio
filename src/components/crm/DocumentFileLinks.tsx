import { Download, ExternalLink } from "lucide-react";

/**
 * View / Download for one stored document (client corrections 2026-10-05:
 * every traveller's documents can be viewed and downloaded from the
 * Booking). Nothing is shown for a purged file or one not uploaded yet.
 */
export function DocumentFileLinks({ fileUrl, purgedAt }: { fileUrl: string | null; purgedAt?: string | null }) {
  if (!fileUrl || purgedAt) return null;
  const separator = fileUrl.includes("?") ? "&" : "?";
  return (
    <span className="inline-flex items-center gap-3 text-xs">
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink-accent hover:underline">
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        View
      </a>
      <a href={`${fileUrl}${separator}download=1`} className="inline-flex items-center gap-1 font-medium text-ink-accent hover:underline">
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Download
      </a>
    </span>
  );
}
