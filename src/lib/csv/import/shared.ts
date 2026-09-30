import type { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { db } from "../../db";
import type { CsvTableRecord } from "../parse-csv";
import type { ImportRowResult } from "../import-specs";

/** One valid row's write, run inside the commit transaction. */
export type ImportOp = (tx: Prisma.TransactionClient, actor: { userId: string }) => Promise<void>;

export interface PlannedImport {
  rows: ImportRowResult[];
  /** Applies every valid row (and only those) — called inside one transaction. */
  apply: (tx: Prisma.TransactionClient, actor: { userId: string }) => Promise<{ created: number; updated: number }>;
}

export interface EntityImporter {
  /** AuditTrail entityType for the summary row. */
  entityType: string;
  plan: (records: CsvTableRecord[]) => Promise<PlannedImport>;
}

export type CellKind = "string" | "number" | "boolean" | "list";

/** schemaField → [csvColumn, kind]. */
export type CellMapping = Record<string, readonly [string, CellKind]>;

const TRUE_VALUES = new Set(["true", "yes", "y", "1"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0"]);

/**
 * Converts a row's non-blank cells into the plain object a zod create/update
 * schema expects. A blank cell is simply omitted (default on create,
 * unchanged on update). Type-conversion problems become row errors.
 */
export function readCells(values: Record<string, string>, mapping: CellMapping): { input: Record<string, unknown>; errors: string[] } {
  const input: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const [field, [column, kind]] of Object.entries(mapping)) {
    const raw = (values[column] ?? "").trim();
    if (raw === "") continue;
    if (kind === "string") {
      input[field] = raw;
    } else if (kind === "number") {
      const cleaned = raw.replace(/[,₹\s]/g, "");
      const parsed = Number(cleaned);
      if (cleaned === "" || !Number.isFinite(parsed)) errors.push(`${column}: "${raw}" isn't a number.`);
      else input[field] = parsed;
    } else if (kind === "boolean") {
      const lowered = raw.toLowerCase();
      if (TRUE_VALUES.has(lowered)) input[field] = true;
      else if (FALSE_VALUES.has(lowered)) input[field] = false;
      else errors.push(`${column}: "${raw}" isn't true/false.`);
    } else {
      input[field] = raw
        .split(/[|;]/)
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item !== "");
    }
  }
  return { input, errors };
}

/** zod issues → "column: message" strings, using the mapping to name the CSV column rather than the schema field. */
export function zodRowErrors(error: z.ZodError, mapping: CellMapping, extraColumns: Record<string, string> = {}): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "";
    const column = mapping[field]?.[0] ?? extraColumns[field] ?? field;
    return column ? `${column}: ${issue.message}` : issue.message;
  });
}

export function rowResult(line: number, key: string, action: ImportRowResult["action"], errors: string[] = []): ImportRowResult {
  return { line, key, action, errors };
}

export interface CountryRef {
  id: string;
  code: string;
  name: string;
}

/** Country master lookup by code or name (case-insensitive). */
export async function loadCountryLookup(): Promise<(value: string) => CountryRef | undefined> {
  const countries = await db.country.findMany({ select: { id: true, code: true, name: true } });
  const byKey = new Map<string, CountryRef>();
  for (const country of countries) byKey.set(country.name.toLowerCase(), country);
  // Codes win over names on a clash — they're the documented reference.
  for (const country of countries) byKey.set(country.code.toLowerCase(), country);
  return (value: string) => byKey.get(value.trim().toLowerCase());
}

export interface NationalityRef {
  id: string;
  name: string;
}

/** Nationality master lookup by name (case-insensitive). */
export async function loadNationalityLookup(): Promise<(value: string) => NationalityRef | undefined> {
  const rows = await db.nationality.findMany({ select: { id: true, name: true } });
  const byName = new Map(rows.map((row) => [row.name.toLowerCase(), row] as const));
  return (value: string) => byName.get(value.trim().toLowerCase());
}

/** Tracks natural keys already seen in this file so a repeated key is an error on its later line(s). */
export function createDuplicateTracker() {
  const seen = new Map<string, number>();
  return (key: string, line: number): string | null => {
    const firstLine = seen.get(key);
    if (firstLine !== undefined) return `Duplicate of line ${firstLine} in this file.`;
    seen.set(key, line);
    return null;
  };
}

/** Groups existing rows by natural key — more than one match means the key is ambiguous and the row can't be imported safely. */
export function indexByKey<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = index.get(key);
    if (list) list.push(row);
    else index.set(key, [row]);
  }
  return index;
}

export const AMBIGUOUS_MATCH = "More than one existing row matches this key — fix the duplicates in Admin first.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD → Date (UTC midnight), or an error message. */
export function parseIsoDate(value: string, column: string): { date: Date; error?: undefined } | { date?: undefined; error: string } {
  if (!ISO_DATE.test(value)) return { error: `${column}: use YYYY-MM-DD.` };
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return { error: `${column}: "${value}" isn't a real date.` };
  return { date };
}

/** Runs the collected ops, counting creates/updates. */
export function buildApply(ops: { kind: "create" | "update"; run: ImportOp }[]): PlannedImport["apply"] {
  return async (tx, actor) => {
    let created = 0;
    let updated = 0;
    for (const op of ops) {
      await op.run(tx, actor);
      if (op.kind === "create") created++;
      else updated++;
    }
    return { created, updated };
  };
}
