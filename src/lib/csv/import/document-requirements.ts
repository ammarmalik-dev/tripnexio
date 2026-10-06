import { resolveDocumentType } from "../../documents/document-master";
import { db } from "../../db";
import { createDocumentRequirementSchema, updateDocumentRequirementSchema } from "../../validation/document-requirement-schema";
import {
  AMBIGUOUS_MATCH,
  buildApply,
  createDuplicateTracker,
  indexByKey,
  loadCountryLookup,
  loadNationalityLookup,
  readCells,
  rowResult,
  zodRowErrors,
  type CellMapping,
  type EntityImporter,
  type ImportOp,
} from "./shared";
import type { ImportRowResult } from "../import-specs";

const MAPPING: CellMapping = {
  serviceType: ["service_type", "string"],
  paxType: ["pax_type", "string"],
  documentName: ["document_name", "string"],
  required: ["required", "boolean"],
  active: ["active", "boolean"],
};
const EXTRA_COLUMNS = { countryId: "country_code", nationalityId: "nationality" };

interface RequirementKeyParts {
  serviceType: string;
  countryId: string | null;
  nationality: string | null;
  paxType: string | null;
  documentName: string;
}

const requirementKey = (parts: RequirementKeyParts) =>
  [parts.serviceType, parts.countryId ?? "", (parts.nationality ?? "").toLowerCase(), parts.paxType ?? "", parts.documentName.trim().toLowerCase()].join("|");

/**
 * Document Requirements — matched by service + country + nationality + pax
 * type + document name (the same combination the manual form treats as a
 * duplicate; the name is compared case-insensitively). Only `required` and
 * `active` change on an update — every other column is part of the key.
 */
export const documentRequirementsImporter: EntityImporter = {
  entityType: "DocumentRequirement",
  async plan(records) {
    const [findCountry, findNationality, existing] = await Promise.all([
      loadCountryLookup(),
      loadNationalityLookup(),
      db.documentRequirement.findMany({
        select: { id: true, serviceType: true, countryId: true, nationality: true, nationalityId: true, paxType: true, documentName: true },
      }),
    ]);
    const existingByKey = indexByKey(existing, (row) => requirementKey(row));
    const checkDuplicate = createDuplicateTracker();

    const rows: ImportRowResult[] = [];
    const ops: { kind: "create" | "update"; run: ImportOp }[] = [];

    for (const record of records) {
      const { input, errors } = readCells(record.values, MAPPING);
      if (typeof input.serviceType === "string") input.serviceType = input.serviceType.toUpperCase();
      if (typeof input.paxType === "string") input.paxType = input.paxType.toUpperCase();

      const countryValue = record.values.country_code ?? "";
      const country = countryValue ? findCountry(countryValue) : undefined;
      if (countryValue && !country) errors.push(`country_code: unknown country "${countryValue}" — add it under Admin → Countries first.`);
      if (country) input.countryId = country.id;

      const nationalityValue = record.values.nationality ?? "";
      const nationality = nationalityValue ? findNationality(nationalityValue) : undefined;
      if (nationalityValue && !nationality) errors.push(`nationality: unknown nationality "${nationalityValue}" — add it under Admin → Nationalities first.`);
      input.nationalityId = nationality?.id ?? null;

      const displayKey = [
        typeof input.serviceType === "string" ? input.serviceType : "?",
        country?.code ?? "any country",
        nationality?.name ?? "all nationalities",
        (typeof input.paxType === "string" && input.paxType) || "all pax",
        typeof input.documentName === "string" ? input.documentName : "(no document name)",
      ].join(" / ");

      const parsed = createDocumentRequirementSchema.safeParse(input);
      if (!parsed.success) errors.push(...zodRowErrors(parsed.error, MAPPING, EXTRA_COLUMNS));
      if (errors.length > 0 || !parsed.success) {
        rows.push(rowResult(record.line, displayKey, "error", errors));
        continue;
      }

      const data = parsed.data;
      const key = requirementKey({
        serviceType: data.serviceType,
        countryId: data.countryId ?? null,
        nationality: nationality?.name ?? null,
        paxType: data.paxType ?? null,
        // The CSV always has document_name (MAPPING); the schema only makes it optional for the Admin screen.
        documentName: data.documentName ?? "",
      });
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
        const partial = updateDocumentRequirementSchema.safeParse(input);
        if (!partial.success) {
          rows.push(rowResult(record.line, displayKey, "error", zodRowErrors(partial.error, MAPPING, EXTRA_COLUMNS)));
          continue;
        }
        const changes = {
          required: partial.data.required,
          active: partial.data.active,
          ...(nationality && !match.nationalityId ? { nationalityId: nationality.id, nationality: nationality.name } : {}),
        };
        rows.push(rowResult(record.line, displayKey, "update"));
        ops.push({
          kind: "update",
          run: async (tx) => {
            await tx.documentRequirement.update({ where: { id: match.id }, data: changes });
          },
        });
      } else {
        rows.push(rowResult(record.line, displayKey, "create"));
        ops.push({
          kind: "create",
          run: async (tx) => {
            // Client corrections 2026-10-05 — linked to (or added to) the Document Master.
            const document = await resolveDocumentType({ documentName: data.documentName }, tx);
            await tx.documentRequirement.create({
              data: {
                serviceType: data.serviceType,
                countryId: data.countryId ?? null,
                nationalityId: nationality?.id ?? null,
                nationality: nationality?.name ?? null,
                paxType: data.paxType ?? null,
                documentName: document?.documentName ?? data.documentName ?? "",
                documentTypeId: document?.documentTypeId ?? null,
                required: data.required,
                active: data.active,
              },
            });
          },
        });
      }
    }

    return { rows, apply: buildApply(ops) };
  },
};
