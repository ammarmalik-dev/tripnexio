import { db } from "../../db";
import { createBorderSchema, updateBorderSchema } from "../../validation/border-schema";
import {
  AMBIGUOUS_MATCH,
  buildApply,
  createDuplicateTracker,
  indexByKey,
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
  name: ["name", "string"],
  uaeLocation: ["uae_location", "string"],
  destinationLocation: ["destination_location", "string"],
  activeForVisaChange: ["active_for_visa_change", "boolean"],
  displayOrder: ["display_order", "number"],
  active: ["active", "boolean"],
};

const borderKey = (name: string, countryId: string) => `${name.trim().toLowerCase()}|${countryId}`;

/**
 * Borders — matched by crossing name (case-insensitive) + the non-UAE
 * side's country. `country_code` resolves against Admin → Countries; an
 * unknown code is a row error, never a new country.
 */
export const bordersImporter: EntityImporter = {
  entityType: "Border",
  async plan(records) {
    const findCountry = await loadCountryLookup();
    const existing = await db.border.findMany({ select: { id: true, name: true, countryId: true } });
    const existingByKey = indexByKey(existing, (border) => borderKey(border.name, border.countryId));
    const checkDuplicate = createDuplicateTracker();

    const rows: ImportRowResult[] = [];
    const ops: { kind: "create" | "update"; run: ImportOp }[] = [];

    for (const record of records) {
      const { input, errors } = readCells(record.values, MAPPING);
      const countryValue = record.values.country_code ?? "";
      const country = countryValue ? findCountry(countryValue) : undefined;
      if (!countryValue) errors.push("country_code: required.");
      else if (!country) errors.push(`country_code: unknown country "${countryValue}" — add it under Admin → Countries first.`);
      if (country) input.countryId = country.id;

      const displayKey = `${typeof input.name === "string" ? input.name : "(no name)"} / ${country?.code ?? (countryValue || "?")}`;
      const parsed = createBorderSchema.safeParse(input);
      if (!parsed.success) errors.push(...zodRowErrors(parsed.error, MAPPING, { countryId: "country_code" }));
      if (errors.length > 0 || !parsed.success) {
        rows.push(rowResult(record.line, displayKey, "error", errors));
        continue;
      }
      const data = parsed.data;
      const key = borderKey(data.name, data.countryId);
      const duplicate = checkDuplicate(key, record.line);
      if (duplicate) {
        rows.push(rowResult(record.line, displayKey, "error", [duplicate]));
        continue;
      }

      const matches = existingByKey.get(key) ?? [];
      if (matches.length > 1) {
        rows.push(rowResult(record.line, displayKey, "error", [AMBIGUOUS_MATCH]));
        continue;
      }
      const match = matches[0];
      if (match) {
        const partial = updateBorderSchema.safeParse(input);
        if (!partial.success) {
          rows.push(rowResult(record.line, displayKey, "error", zodRowErrors(partial.error, MAPPING, { countryId: "country_code" })));
          continue;
        }
        const changes = partial.data;
        rows.push(rowResult(record.line, displayKey, "update"));
        ops.push({
          kind: "update",
          run: async (tx) => {
            await tx.border.update({ where: { id: match.id }, data: changes });
          },
        });
      } else {
        rows.push(rowResult(record.line, displayKey, "create"));
        ops.push({
          kind: "create",
          run: async (tx) => {
            await tx.border.create({ data });
          },
        });
      }
    }

    return { rows, apply: buildApply(ops) };
  },
};
