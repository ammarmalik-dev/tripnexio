interface TimelineEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  note: string | null;
  timestamp: string;
  byUser: { name: string } | null;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chronological (oldest first) — reads like a narrative of everything that happened for this lead. */
export function LeadTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-tertiary">No activity recorded yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-ink-primary">
              <span className="font-medium">{entry.entityType}</span>{" "}
              <span className="text-ink-tertiary">· {entry.action}</span>
            </p>
            {entry.note ? <p className="text-sm text-ink-secondary">{entry.note}</p> : null}
            <p className="text-xs text-ink-tertiary">
              {formatTimestamp(entry.timestamp)}
              {entry.byUser ? ` · ${entry.byUser.name}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
