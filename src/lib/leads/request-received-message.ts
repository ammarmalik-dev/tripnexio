import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client testing 2026-10-09 (B9/B19/B24, C8) — one "request received" text per
 * service, shown on the website success screen AND sent in the WhatsApp/email
 * "Request received" message (the `{{requestMessage}}` template variable), so
 * the customer reads the same words everywhere. Special Fare, Visa Extension
 * and Visa Change are the client's wording, verbatim.
 */
export const REQUEST_RECEIVED_MESSAGES: Record<ServiceType, string> = {
  FLIGHT_SPECIAL_FARE:
    "Your Special Fare request has been received successfully. Our team will check the available fares and share your quotation with you shortly on WhatsApp and email.",
  VISA_EXTENSION:
    "Your Visa Extension request has been received. Our team will validate each applicant's details and documents and get in touch shortly.",
  VISA_CHANGE: "Your Visa Change request has been received. Our team will check availability and get in touch shortly.",
  NEW_VISA: "Your New Visa request has been received. Our team will review the details and get in touch shortly.",
  OTB: "Your OTB request has been received. Our team will verify the details and get in touch shortly.",
  RETURN_TICKET: "Your Return Verified Ticket request has been received. Our team will confirm your reservation and get in touch shortly.",
  OTHER: "Your request has been received. Our team will get in touch shortly.",
};

export function requestReceivedMessage(serviceType: ServiceType): string {
  return REQUEST_RECEIVED_MESSAGES[serviceType] ?? REQUEST_RECEIVED_MESSAGES.OTHER;
}
