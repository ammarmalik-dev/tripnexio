"use client";

import { ServiceOptionMasterManager, type ServiceOptionMasterConfig } from "./ServiceOptionMasterManager";
import type { ServiceType } from "../../generated/prisma/enums";

const PROCESSING_TYPES_CONFIG: ServiceOptionMasterConfig = {
  apiPath: "/api/admin/processing-types",
  titleKey: "label",
  titleLabel: "Label shown to customers",
  noun: "processing type",
  nounPlural: "processing types",
  // The code is stored on leads and pricing rules — fixed once created.
  codeEditable: false,
  codeHint: "Stored value — the request forms accept normal and urgent",
  emptyDescription:
    "Until one is added, the request forms fall back to the standard Normal / Express (New Visa) or Normal / Urgent pair.",
};

/**
 * P23 — Admin processing-type master. Rename a label (e.g. "Express") or
 * disable a code to hide it from the customer form; the stored code never
 * changes. With `serviceType`, lists/creates only for that service.
 */
export function ProcessingTypesManager({ serviceType }: { serviceType?: ServiceType }) {
  return <ServiceOptionMasterManager config={PROCESSING_TYPES_CONFIG} serviceType={serviceType} />;
}
