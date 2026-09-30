/**
 * Shared CSV reading for the Admin bulk imports (Airports, Airlines, Borders,
 * Vendors, Pricing Rules, Document Requirements). Client-safe — no server
 * imports — though today only the server parses uploads.
 */

/** Minimal RFC-4180 record splitter: handles quoted fields, escaped quotes ("") and commas/newlines inside quotes. Blank lines are skipped. */
export function splitCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((value) => value.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  record.push(field);
  if (record.some((value) => value.trim() !== "")) records.push(record);
  return records;
}

export interface CsvTableRecord {
  /** 1-based line number in the file (the header is line 1). */
  line: number;
  /** Trimmed cell values keyed by lower-cased header name; a blank cell is "". */
  values: Record<string, string>;
}

export type CsvTableResult = { records: CsvTableRecord[]; error?: undefined } | { records?: undefined; error: string };

/**
 * Splits a CSV with a header row into records keyed by column name. Header
 * matching is case-insensitive and order-independent; unknown extra columns
 * are ignored. Missing required columns fail the whole file (one clear
 * message) rather than every row.
 *
 * Note: line numbers count records, not physical lines — a quoted cell that
 * itself contains a newline shifts later numbers by one. Good enough for an
 * admin to find the row; import templates never need multi-line cells.
 */
export function parseCsvTable(text: string, requiredColumns: readonly string[]): CsvTableResult {
  const rows = splitCsv(text.replace(/^﻿/, ""));
  if (rows.length === 0) return { error: "The file is empty." };

  const header = rows[0].map((value) => value.trim().toLowerCase());
  const missing = requiredColumns.filter((column) => !header.includes(column.toLowerCase()));
  if (missing.length > 0) return { error: `Missing required column(s): ${missing.join(", ")}.` };
  if (rows.length === 1) return { error: "The file has a header row but no data rows." };

  const records = rows.slice(1).map((row, offset) => {
    const values: Record<string, string> = {};
    header.forEach((name, index) => {
      if (name) values[name] = (row[index] ?? "").trim();
    });
    return { line: offset + 2, values };
  });
  return { records };
}

/** Headers-only CSV line for a template download. */
export function csvHeaderLine(columns: readonly string[]): string {
  return `${columns.join(",")}\n`;
}
