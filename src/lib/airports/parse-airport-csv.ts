export interface AirportCsvRow {
  line: number;
  name: string;
  code: string;
  city: string;
  country: string;
}

export interface AirportCsvParseResult {
  rows: AirportCsvRow[];
  errors: { line: number; message: string }[];
}

/** Minimal RFC-4180 record splitter: handles quoted fields, escaped quotes ("") and commas/newlines inside quotes. */
function splitCsv(text: string): string[][] {
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

/**
 * Parses an admin-supplied airport CSV in the client's agreed format: the
 * header row is `iata_code,airport_name,city,country` (any column order,
 * case-insensitive) — this is the client's own data, never something the app
 * invents (hard rule #1).
 */
export function parseAirportCsv(text: string): AirportCsvParseResult {
  const records = splitCsv(text.replace(/^﻿/, ""));
  if (records.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty." }] };

  const header = records[0].map((value) => value.trim().toLowerCase());
  const columnIndex = (name: string) => header.indexOf(name);
  const indexes = {
    name: columnIndex("airport_name"),
    code: columnIndex("iata_code"),
    city: columnIndex("city"),
    country: columnIndex("country"),
  };
  const columnNames: Record<string, string> = { name: "airport_name", code: "iata_code", city: "city", country: "country" };
  const missing = Object.entries(indexes)
    .filter(([, index]) => index === -1)
    .map(([name]) => columnNames[name]);
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, message: `Missing required column(s): ${missing.join(", ")}.` }] };
  }

  const rows: AirportCsvRow[] = [];
  const errors: { line: number; message: string }[] = [];
  records.slice(1).forEach((record, offset) => {
    const line = offset + 2;
    const row = {
      line,
      name: (record[indexes.name] ?? "").trim(),
      code: (record[indexes.code] ?? "").trim().toUpperCase(),
      city: (record[indexes.city] ?? "").trim(),
      country: (record[indexes.country] ?? "").trim(),
    };
    if (!row.name || !row.city || !row.country) {
      errors.push({ line, message: "name, city and country are all required." });
    } else if (!/^[A-Z]{3,4}$/.test(row.code)) {
      errors.push({ line, message: `"${row.code}" isn't a valid 3-4 letter airport code.` });
    } else {
      rows.push(row);
    }
  });
  return { rows, errors };
}
