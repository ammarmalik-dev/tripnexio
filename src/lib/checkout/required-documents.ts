import type { ServiceType } from "../../generated/prisma/enums";

export interface CheckoutDocumentType {
  /** Stored as Document.type. */
  type: string;
  label: string;
}

/**
 * Documents asked for AFTER payment on the pay-right-after-the-form services
 * — exactly the lists in the client's Developer Handover documents (Return
 * Ticket: Passport Copy, Visa Copy, Onward Ticket; OTB: those plus Return
 * Ticket). Each is collected per applicant.
 */
const REQUIRED_DOCUMENTS: Partial<Record<ServiceType, CheckoutDocumentType[]>> = {
  RETURN_TICKET: [
    { type: "PASSPORT", label: "Passport copy" },
    { type: "VISA_COPY", label: "Visa copy" },
    { type: "ONWARD_TICKET", label: "Onward ticket" },
  ],
  OTB: [
    { type: "PASSPORT", label: "Passport copy" },
    { type: "VISA_COPY", label: "Visa copy" },
    { type: "ONWARD_TICKET", label: "Onward ticket" },
    { type: "RETURN_TICKET", label: "Return ticket" },
  ],
};

export function getCheckoutDocumentTypes(serviceType: ServiceType): CheckoutDocumentType[] {
  return REQUIRED_DOCUMENTS[serviceType] ?? [];
}

export function isCheckoutService(serviceType: ServiceType): boolean {
  return serviceType in REQUIRED_DOCUMENTS;
}
