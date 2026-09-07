import type {
  ServiceType,
  LeadStatus,
  DocumentStatus,
  BookingStatus,
  PaxType,
  PaymentStatus,
  RefundStatus,
  GccCountry,
  CouponType,
  NotificationChannel,
} from "../../generated/prisma/enums";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  NEW_VISA: "New Visa",
  VISA_EXTENSION: "Visa Extension",
  VISA_CHANGE: "Visa Change",
  FLIGHT_SPECIAL_FARE: "Flight Special Fare",
  RETURN_TICKET: "Return Ticket",
  OTB: "OTB",
};

export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = (
  Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]
).map(([value, label]) => ({ value, label }));

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  QUOTED: "Quoted",
  CONVERTED: "Converted",
  ON_HOLD: "On Hold",
  LOST: "Lost",
};

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = (
  Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]
).map(([value, label]) => ({ value, label }));

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  REQUIRED: "Required",
  MISSING: "Missing",
  RECEIVED: "Received",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const BOOKING_STATUS_OPTIONS: { value: BookingStatus; label: string }[] = (
  Object.entries(BOOKING_STATUS_LABELS) as [BookingStatus, string][]
).map(([value, label]) => ({ value, label }));

export const PAX_TYPE_LABELS: Record<PaxType, string> = {
  ADULT: "Adult",
  CHILD: "Child",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  SUCCESS: "Success",
  FAILED: "Failed",
  EXPIRED: "Expired",
};

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = (
  Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][]
).map(([value, label]) => ({ value, label }));

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export const REFUND_STATUS_OPTIONS: { value: RefundStatus; label: string }[] = (
  Object.entries(REFUND_STATUS_LABELS) as [RefundStatus, string][]
).map(([value, label]) => ({ value, label }));

export const DOCUMENT_STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = (
  Object.entries(DOCUMENT_STATUS_LABELS) as [DocumentStatus, string][]
).map(([value, label]) => ({ value, label }));

/** The locked market scope from CLAUDE.md (India to UAE/GCC) plus OTHER as a fallback — not sample data, matches the GccCountry enum exactly. */
export const GCC_COUNTRY_LABELS: Record<GccCountry, string> = {
  INDIA: "India",
  UAE: "United Arab Emirates",
  SAUDI_ARABIA: "Saudi Arabia",
  BAHRAIN: "Bahrain",
  KUWAIT: "Kuwait",
  OMAN: "Oman",
  QATAR: "Qatar",
  OTHER: "Other",
};

export const GCC_COUNTRY_OPTIONS: { value: GccCountry; label: string }[] = (
  Object.entries(GCC_COUNTRY_LABELS) as [GccCountry, string][]
).map(([value, label]) => ({ value, label }));

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed Amount",
};

export const COUPON_TYPE_OPTIONS: { value: CouponType; label: string }[] = (
  Object.entries(COUPON_TYPE_LABELS) as [CouponType, string][]
).map(([value, label]) => ({ value, label }));

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

export const NOTIFICATION_CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = (
  Object.entries(NOTIFICATION_CHANNEL_LABELS) as [NotificationChannel, string][]
).map(([value, label]) => ({ value, label }));
