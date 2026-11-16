/**
 * Client doc 16 Nov (I2) — the quotation services whose accepted quotation the customer may pay by bank transfer
 * (bank details from Admin → Invoice Settings, receipt uploaded on the payment page, approved by an authorised
 * approver before the booking becomes active).
 */
export const OFFLINE_PAYMENT_SERVICES = new Set<string>(["VISA_CHANGE", "VISA_EXTENSION", "FLIGHT_SPECIAL_FARE"]);
