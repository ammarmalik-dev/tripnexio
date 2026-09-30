import { db } from "../../db";
import { createAdminVendorSchema, updateAdminVendorSchema } from "../../validation/admin-vendor-schema";
import {
  AMBIGUOUS_MATCH,
  buildApply,
  createDuplicateTracker,
  indexByKey,
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
  services: ["services", "list"],
  mobile: ["mobile", "string"],
  email: ["email", "string"],
  pocName: ["poc_name", "string"],
  gstNumber: ["gst_number", "string"],
  availability: ["availability", "string"],
  processingDetails: ["processing_details", "string"],
  paymentDetails: ["payment_details", "string"],
  serviceSuitabilityScore: ["service_suitability_score", "number"],
  processingTimeScore: ["processing_time_score", "number"],
  performanceScore: ["performance_score", "number"],
  reliabilityScore: ["reliability_score", "number"],
  active: ["active", "boolean"],
};

const vendorKey = (name: string) => name.trim().toLowerCase();

/**
 * Vendors — matched by name (case-insensitive; Vendor.name has no DB
 * uniqueness, so two existing vendors sharing a name make the row an error
 * rather than a guess). `services` replaces the vendor's service list the
 * same way the Vendor edit form does: unchanged services keep their
 * VendorService row (and its cost/rate), removed ones are deleted, new ones
 * created.
 */
export const vendorsImporter: EntityImporter = {
  entityType: "Vendor",
  async plan(records) {
    const existing = await db.vendor.findMany({ select: { id: true, name: true } });
    const existingByKey = indexByKey(existing, (vendor) => vendorKey(vendor.name));
    const checkDuplicate = createDuplicateTracker();

    const rows: ImportRowResult[] = [];
    const ops: { kind: "create" | "update"; run: ImportOp }[] = [];

    for (const record of records) {
      const { input, errors } = readCells(record.values, MAPPING);
      const displayKey = typeof input.name === "string" ? input.name : "(no name)";
      const parsed = createAdminVendorSchema.safeParse(input);
      if (!parsed.success) errors.push(...zodRowErrors(parsed.error, MAPPING));
      if (errors.length > 0 || !parsed.success) {
        rows.push(rowResult(record.line, displayKey, "error", errors));
        continue;
      }
      const { services, ...vendorFields } = parsed.data;
      const uniqueServices = [...new Set(services)];
      const key = vendorKey(vendorFields.name);
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
        const partial = updateAdminVendorSchema.safeParse(input);
        if (!partial.success) {
          rows.push(rowResult(record.line, displayKey, "error", zodRowErrors(partial.error, MAPPING)));
          continue;
        }
        // `services` is applied separately below (VendorService diff), never as a Vendor column.
        const { services: partialServices, ...changes } = partial.data;
        void partialServices;
        rows.push(rowResult(record.line, displayKey, "update"));
        ops.push({
          kind: "update",
          run: async (tx) => {
            const current = await tx.vendorService.findMany({ where: { vendorId: match.id }, select: { service: true } });
            const currentSet = new Set(current.map((row) => row.service));
            const nextSet = new Set(uniqueServices);
            const removed = [...currentSet].filter((service) => !nextSet.has(service));
            const added = [...nextSet].filter((service) => !currentSet.has(service));
            if (removed.length) await tx.vendorService.deleteMany({ where: { vendorId: match.id, service: { in: removed } } });
            if (added.length) await tx.vendorService.createMany({ data: added.map((service) => ({ vendorId: match.id, service })) });
            await tx.vendor.update({ where: { id: match.id }, data: changes });
          },
        });
      } else {
        rows.push(rowResult(record.line, displayKey, "create"));
        ops.push({
          kind: "create",
          run: async (tx) => {
            await tx.vendor.create({
              data: { ...vendorFields, services: { create: uniqueServices.map((service) => ({ service })) } },
            });
          },
        });
      }
    }

    return { rows, apply: buildApply(ops) };
  },
};
