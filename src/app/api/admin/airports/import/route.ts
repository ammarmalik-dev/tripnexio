import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseAirportCsv } from "@/lib/airports/parse-airport-csv";

const MAX_ROWS = 5000;
const MAX_REPORTED_ERRORS = 50;

const importSchema = z.object({ csv: z.string().min(1, "Paste or upload a CSV") });

/**
 * Bulk airport import from an admin-supplied CSV (name, code, city,
 * country). Rows are upserted by IATA code — new codes are created, existing
 * ones have name/city/country refreshed (their A2A/active flags and display
 * order are left alone). `country` must match an existing Country by code or
 * name; an unknown country is reported per row instead of being invented.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsedBody = importSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, "Please check the highlighted fields.", parsedBody.error.flatten().fieldErrors);
  }

  const { rows, errors } = parseAirportCsv(parsedBody.data.csv);
  if (rows.length === 0) {
    return jsonError(400, errors[0]?.message ?? "No valid airport rows found in the file.");
  }
  if (rows.length > MAX_ROWS) {
    return jsonError(400, `Too many rows — import at most ${MAX_ROWS} airports at a time.`);
  }

  try {
    const countries = await db.country.findMany();
    const countryLookup = new Map<string, { id: string; name: string }>();
    for (const country of countries) {
      countryLookup.set(country.code.toLowerCase(), country);
      countryLookup.set(country.name.toLowerCase(), country);
    }

    const existing = await db.airport.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((airport) => airport.code));
    const seenCodes = new Set<string>();

    let created = 0;
    let updated = 0;
    const rowErrors = [...errors];

    for (const row of rows) {
      const country = countryLookup.get(row.country.toLowerCase());
      if (!country) {
        rowErrors.push({ line: row.line, message: `Unknown country "${row.country}" — add it under Admin → Countries first.` });
        continue;
      }
      if (seenCodes.has(row.code)) {
        rowErrors.push({ line: row.line, message: `Code ${row.code} appears more than once in this file.` });
        continue;
      }
      seenCodes.add(row.code);

      const data = { name: row.name, city: row.city, country: country.name, countryId: country.id };
      if (existingCodes.has(row.code)) {
        await db.airport.update({ where: { code: row.code }, data });
        updated++;
      } else {
        await db.airport.create({ data: { ...data, code: row.code } });
        created++;
      }
    }

    await writeAudit(db, {
      entityType: "Airport",
      entityId: "bulk-import",
      action: "IMPORT",
      byUserId: session.id,
      note: `Airport CSV import: ${created} created, ${updated} updated, ${rowErrors.length} row error(s) (by ${session.name})`,
    });

    return jsonSuccess({
      created,
      updated,
      errorCount: rowErrors.length,
      errors: rowErrors.slice(0, MAX_REPORTED_ERRORS),
    });
  } catch (error) {
    console.error("[api/admin/airports/import]", error);
    return jsonError(500, "Something went wrong while importing airports. Please try again.");
  }
}
