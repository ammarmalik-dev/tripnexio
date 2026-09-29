"use client";

import { ServiceOptionMasterManager, type ServiceOptionMasterConfig } from "./ServiceOptionMasterManager";
import type { ServiceType } from "../../generated/prisma/enums";

const SUB_SERVICES_CONFIG: ServiceOptionMasterConfig = {
  apiPath: "/api/admin/sub-services",
  titleKey: "name",
  titleLabel: "Name",
  noun: "sub-service",
  nounPlural: "sub-services",
  codeEditable: true,
  codeHint: "Short internal code, e.g. tourist_30d",
  emptyDescription: "Add the first sub-service using the form below.",
};

/** P23 — Admin sub-services master. With `serviceType`, lists/creates only for that service. */
export function SubServicesManager({ serviceType }: { serviceType?: ServiceType }) {
  return <ServiceOptionMasterManager config={SUB_SERVICES_CONFIG} serviceType={serviceType} />;
}
