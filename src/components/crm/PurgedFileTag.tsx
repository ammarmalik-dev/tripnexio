/** P27 - shown where a document's file was deleted by the retention job (the record stays). */
export function PurgedFileTag({ purgedAt }: { purgedAt?: string | Date | null }) {
  if (!purgedAt) return null;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full bg-ink-primary/[0.06] px-2 py-0.5 text-xs font-medium text-ink-tertiary"
      title={`File deleted after the retention period on ${new Date(purgedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
    >
      Deleted after retention period
    </span>
  );
}
