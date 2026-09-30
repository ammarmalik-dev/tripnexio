import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { parseCsvTable } from "@/lib/csv/parse-csv";
import { IMPORTERS } from "@/lib/csv/import";
import {
  IMPORT_SPECS,
  isImportEntityKey,
  requiredColumns,
  type ImportCommitResult,
  type ImportPreviewResult,
} from "@/lib/csv/import-specs";

const MAX_ROWS = 2000;
const MAX_CSV_CHARS = 2_000_000;

const bodySchema = z.object({
  mode: z.enum(["preview", "commit"], { error: "mode must be preview or commit" }),
  csv: z.string().min(1, "Paste or upload a CSV").max(MAX_CSV_CHARS, "That file is too large — split it into smaller imports."),
  filename: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

interface RouteParams {
  params: Promise<{ entity: string }>;
}

/**
 * P26 — CSV bulk import for Airlines, Borders, Vendors, Pricing Rules and
 * Document Requirements (Airports keep their own /api/admin/airports/import).
 *
 * One route, two modes:
 *   - `mode: "preview"` parses + validates every row (zod row schemas built
 *     from each entity's own create/update schemas, references resolved by
 *     human codes) and reports create / update / error per row. Nothing is
 *     written.
 *   - `mode: "commit"` re-runs the exact same plan server-side (the client's
 *     preview is never trusted), then applies only the valid rows in one
 *     transaction with a summary AuditTrail row (counts + filename) — and
 *     PricingRuleHistory rows for pricing rules. Vendor, pricing and
 *     document-requirement imports are Business Rules §14 sensitive and
 *     require a confirmation `reason` on commit.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { entity } = await params;
  if (!isImportEntityKey(entity)) return jsonError(404, "Unknown import type.");
  const spec = IMPORT_SPECS[entity];
  const importer = IMPORTERS[entity];

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, "Please check the highlighted fields.", parsedBody.error.flatten().fieldErrors);
  }
  const { mode, csv, filename } = parsedBody.data;

  let reason: string | undefined;
  if (mode === "commit" && spec.sensitive) {
    const reasonResult = readBodyReason(body);
    if (reasonResult.error) return reasonResult.error;
    reason = reasonResult.reason;
  }

  const table = parseCsvTable(csv, requiredColumns(spec));
  const records = table.records;
  if (!records) {
    const message = table.error ?? "Couldn't read that CSV.";
    return jsonError(400, message, { csv: [message] });
  }
  if (records.length > MAX_ROWS) {
    return jsonError(400, `Too many rows — import at most ${MAX_ROWS} rows at a time.`, { csv: [`At most ${MAX_ROWS} rows per file.`] });
  }

  try {
    const plan = await importer.plan(records);
    const totals = {
      create: plan.rows.filter((row) => row.action === "create").length,
      update: plan.rows.filter((row) => row.action === "update").length,
      error: plan.rows.filter((row) => row.action === "error").length,
    };

    if (mode === "preview") {
      const preview: ImportPreviewResult = { entity, filename: filename ?? null, totals, rows: plan.rows };
      return jsonSuccess(preview);
    }

    if (totals.create + totals.update === 0) {
      return jsonError(400, "No valid rows to import — fix the errors shown in the preview first.");
    }

    const { created, updated } = await db.$transaction(
      async (tx) => {
        const counts = await plan.apply(tx, { userId: session.id });
        const note = `${spec.label} CSV import${filename ? ` "${filename}"` : ""}: ${counts.created} created, ${counts.updated} updated, ${totals.error} row(s) skipped with errors (by ${session.name})`;
        await writeAudit(tx, {
          entityType: importer.entityType,
          entityId: "bulk-import",
          action: "IMPORT",
          byUserId: session.id,
          note: reason ? withReason(note, reason) : note,
        });
        return counts;
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    const result: ImportCommitResult = { entity, filename: filename ?? null, created, updated, skipped: totals.error, rows: plan.rows };
    return jsonSuccess(result);
  } catch (error) {
    console.error(`[api/admin/import/${entity}]`, error);
    return jsonError(500, `Something went wrong while importing ${spec.label.toLowerCase()}. Nothing was changed — please try again.`);
  }
}
