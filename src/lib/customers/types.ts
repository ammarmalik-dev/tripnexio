import type {
  BookingStatus,
  DocumentStatus,
  LeadStatus,
  PaxType,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  RefundStatus,
  ServiceType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../../generated/prisma/enums";

/**
 * JSON shapes returned by GET /api/customers and GET /api/customers/[id]
 * (CRM.md §23 Customers). Dates are ISO strings and money is a decimal
 * string, exactly as they arrive on the client. Quotation shapes carry the
 * customer-facing selling price only — vendorCost, margin, vendor and
 * vendorReference are never selected (CLAUDE.md: vendor cost and margin
 * stay internal).
 */

export interface CustomerListItem {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  leadCount: number;
  bookingCount: number;
  createdAt: string;
}

export interface CustomerListResponse {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Customer360Lead {
  id: string;
  referenceId: string;
  serviceType: ServiceType;
  status: LeadStatus;
  source: string | null;
  createdAt: string;
}

export interface Customer360Booking {
  id: string;
  bookingId: string;
  leadId: string;
  serviceType: ServiceType;
  status: BookingStatus;
  createdAt: string;
}

export interface Customer360Passenger {
  id: string;
  fullName: string;
  passportNumber: string | null;
  nationality: string | null;
  paxType: PaxType;
  dob: string | null;
  createdAt: string;
}

export interface Customer360Quotation {
  id: string;
  leadId: string;
  leadReferenceId: string;
  serviceType: ServiceType;
  sellingPrice: string;
  couponDiscount: string | null;
  airline: string | null;
  route: string | null;
  isSelected: boolean;
  isExpired: boolean;
  validityExpiresAt: string | null;
  createdAt: string;
}

export interface Customer360Payment {
  id: string;
  bookingId: string;
  bookingDisplayId: string;
  amount: string;
  couponDiscount: string | null;
  gstAmount: string;
  gatewayFee: string;
  total: string;
  status: PaymentStatus;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  invoiceNumber: string | null;
  createdAt: string;
}

export interface Customer360Refund {
  id: string;
  paymentId: string;
  bookingId: string;
  bookingDisplayId: string;
  refundAmount: string;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
}

export interface Customer360Document {
  id: string;
  type: string;
  status: DocumentStatus;
  bookingId: string | null;
  bookingDisplayId: string | null;
  passengerName: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface Customer360Communication {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  direction: "INBOUND" | "OUTBOUND";
  /** Notification outcome from the AuditTrail action (e.g. EMAIL_SENT, WHATSAPP_SKIPPED); null for a WhatsApp message-log row. */
  status: string | null;
  body: string;
  sentBy: string | null;
  timestamp: string;
}

export interface Customer360Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  reason: string | null;
  leadId: string | null;
  bookingId: string | null;
  assignedTo: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Customer360TimelineEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  note: string | null;
  timestamp: string;
  byUser: { name: string } | null;
}

/**
 * A section is `null` when the signed-in staff member's role lacks that
 * section's own view permission (bookings.view, quotations.view, …) — the
 * page shows a "no access" note instead of the data.
 */
export interface Customer360Response {
  customer: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    hasAccount: boolean;
    createdAt: string;
    updatedAt: string;
  };
  leads: Customer360Lead[];
  bookings: Customer360Booking[] | null;
  passengers: Customer360Passenger[];
  quotations: Customer360Quotation[] | null;
  payments: Customer360Payment[] | null;
  refunds: Customer360Refund[] | null;
  documents: Customer360Document[] | null;
  communications: Customer360Communication[];
  tasks: Customer360Task[] | null;
  timeline: Customer360TimelineEntry[];
  /** True when a list above was cut at its cap (communications/timeline). */
  truncated: { communications: boolean; timeline: boolean };
}
