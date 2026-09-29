import type { ReactNode } from "react";

/** A JSON value as stored in a history row's oldValues/newValues. */
export type HistoryJson = string | number | boolean | null | HistoryJson[] | { [key: string]: HistoryJson };

export interface ChangeHistoryEntry {
  id: string;
  /** e.g. "CREATE" / "UPDATE" — omitted for rows that are always updates. */
  action?: string;
  /** Extra label shown next to the action, e.g. the service a vendor rate belongs to. */
  tag?: string;
  oldValues: HistoryJson;
  newValues: HistoryJson;
  userName: string | null;
  createdAt: string;
}

function asRecord(value: HistoryJson): Record<string, HistoryJson> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function defaultFormat(value: HistoryJson): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * P23 — shared old → new change log (Pricing rule history, Vendor rate
 * history). Renders only the keys present in `newValues`, so a row that
 * stored just the changed fields shows exactly what changed.
 */
export function ChangeHistoryList({
  entries,
  fieldLabel,
  formatValue,
}: {
  entries: ChangeHistoryEntry[];
  fieldLabel: (field: string) => string;
  /** Returns a display string, or undefined to fall back to the default formatting. */
  formatValue?: (field: string, value: HistoryJson) => string | undefined;
}): ReactNode {
  const format = (field: string, value: HistoryJson) => formatValue?.(field, value) ?? defaultFormat(value);

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => {
        const oldValues = asRecord(entry.oldValues);
        const newValues = asRecord(entry.newValues);
        const isCreate = entry.action === "CREATE";
        return (
          <li key={entry.id} className="rounded-lg border border-hairline bg-surface-base p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-tertiary">
              {entry.action ? (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-ink-accent">{isCreate ? "Created" : "Updated"}</span>
              ) : null}
              {entry.tag ? <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-ink-secondary">{entry.tag}</span> : null}
              <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("en-IN")}</time>
              <span>· by {entry.userName ?? "Unknown user"}</span>
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
              {Object.keys(newValues).map((field) => (
                <div key={field} className="contents">
                  <dt className="font-medium text-ink-secondary">{fieldLabel(field)}</dt>
                  <dd className="text-ink-primary">
                    {isCreate ? (
                      format(field, newValues[field])
                    ) : (
                      <>
                        <span className="text-ink-tertiary line-through">{format(field, oldValues[field] ?? null)}</span>
                        <span aria-hidden="true"> → </span>
                        <span className="sr-only"> changed to </span>
                        {format(field, newValues[field])}
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ol>
  );
}
