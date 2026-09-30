import type { ImportEntityKey } from "../import-specs";
import type { EntityImporter } from "./shared";
import { airlinesImporter } from "./airlines";
import { bordersImporter } from "./borders";
import { vendorsImporter } from "./vendors";
import { pricingRulesImporter } from "./pricing-rules";
import { documentRequirementsImporter } from "./document-requirements";

/** P26 — server-side importer per entity, keyed like IMPORT_SPECS. Airports keep their own older route (/api/admin/airports/import). */
export const IMPORTERS: Record<ImportEntityKey, EntityImporter> = {
  airlines: airlinesImporter,
  borders: bordersImporter,
  vendors: vendorsImporter,
  "pricing-rules": pricingRulesImporter,
  "document-requirements": documentRequirementsImporter,
};

export type { EntityImporter, PlannedImport } from "./shared";
