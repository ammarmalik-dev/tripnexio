import { db } from "../../db";
import { createAirlineSchema, updateAirlineSchema } from "../../validation/airline-schema";
import { buildAirlineLogoUrl } from "../../airlines/fetch-logo";
import {
  buildApply,
  createDuplicateTracker,
  loadCountryLookup,
  readCells,
  rowResult,
  zodRowErrors,
  type CellMapping,
  type EntityImporter,
  type ImportOp,
} from "./shared";
import type { ImportRowResult } from "../import-specs";

const MAPPING: CellMapping = {
  code: ["code", "string"],
  name: ["name", "string"],
  country: ["country", "string"],
  otbRequired: ["otb_required", "boolean"],
  normalPrice: ["normal_price", "number"],
  urgentPrice: ["urgent_price", "number"],
  standardProcessingDays: ["standard_processing_days", "number"],
  urgentProcessingHours: ["urgent_processing_hours", "number"],
  logoUrl: ["logo_url", "string"],
  displayOrder: ["display_order", "number"],
  active: ["active", "boolean"],
};

/**
 * Airlines — matched by IATA code (Airline.code is unique). Airline.country
 * is a free-text column in the schema, so a value matching Admin → Countries
 * (by code or name) is stored as that country's name, and any other value is
 * kept as typed — same as the manual Airlines form.
 */
export const airlinesImporter: EntityImporter = {
  entityType: "Airline",
  async plan(records) {
    const findCountry = await loadCountryLookup();
    const existing = await db.airline.findMany({ select: { id: true, code: true } });
    const idByCode = new Map(existing.map((airline) => [airline.code, airline.id] as const));
    const checkDuplicate = createDuplicateTracker();

    const rows: ImportRowResult[] = [];
    const ops: { kind: "create" | "update"; run: ImportOp }[] = [];

    for (const record of records) {
      const { input, errors } = readCells(record.values, MAPPING);
      const key = typeof input.code === "string" ? input.code.toUpperCase() : "(no code)";
      if (typeof input.country === "string") input.country = findCountry(input.country)?.name ?? input.country;

      const parsed = createAirlineSchema.safeParse(input);
      if (!parsed.success) errors.push(...zodRowErrors(parsed.error, MAPPING));
      if (errors.length > 0 || !parsed.success) {
        rows.push(rowResult(record.line, key, "error", errors));
        continue;
      }
      const data = parsed.data;
      const duplicate = checkDuplicate(data.code, record.line);
      if (duplicate) {
        rows.push(rowResult(record.line, data.code, "error", [duplicate]));
        continue;
      }

      const existingId = idByCode.get(data.code);
      if (existingId) {
        const partial = updateAirlineSchema.safeParse(input);
        if (!partial.success) {
          rows.push(rowResult(record.line, data.code, "error", zodRowErrors(partial.error, MAPPING)));
          continue;
        }
        // The code is the match key — never rewritten by an update.
        const changes = { ...partial.data };
        delete changes.code;
        rows.push(rowResult(record.line, data.code, "update"));
        ops.push({
          kind: "update",
          run: async (tx) => {
            await tx.airline.update({ where: { id: existingId }, data: changes });
          },
        });
      } else {
        rows.push(rowResult(record.line, data.code, "create"));
        ops.push({
          kind: "create",
          run: async (tx) => {
            await tx.airline.create({ data: { ...data, logoUrl: data.logoUrl ?? buildAirlineLogoUrl(data.code) } });
          },
        });
      }
    }

    return { rows, apply: buildApply(ops) };
  },
};
