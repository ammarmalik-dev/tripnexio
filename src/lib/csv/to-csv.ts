export interface CsvColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** Quotes a field only when it needs it (contains a comma, quote, or newline) — doubles any embedded quotes per RFC 4180. */
function csvField(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => csvField(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => csvField(column.value(row))).join(","));
  return [header, ...lines].join("\r\n") + "\r\n";
}
