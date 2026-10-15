import type { ServiceType } from "../../generated/prisma/enums";
/** The internal placeholder vendor a direct-payment booking starts with (see create-auto-checkout.ts). Client-safe (no DB import). */
export const DIRECT_VENDOR_NAME = "Direct (auto-priced)";

/** Client doc 2026-10-15 (I7) — services whose vendor staff pick once every document is validated (see set-vendor.ts). */
export const VENDOR_AFTER_DOCUMENTS_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["OTB", "NEW_VISA", "RETURN_TICKET"]);
