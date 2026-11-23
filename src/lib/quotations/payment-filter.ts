import type { Prisma } from "../../generated/prisma/client";

/**
 * Client doc 16 Nov (J3) — a quotation's payment status, kept apart from its own status: a selected quotation is
 * Paid once its lead has a successful payment, otherwise Unpaid; a quotation not selected has none.
 */
export type QuotationPaymentFilter = "PAID" | "UNPAID";

export function quotationPaymentWhere(filter: QuotationPaymentFilter | undefined): Prisma.QuotationWhereInput {
  if (filter === "PAID") return { isSelected: true, lead: { bookings: { some: { payments: { some: { status: "SUCCESS" } } } } } };
  if (filter === "UNPAID") return { isSelected: true, lead: { bookings: { none: { payments: { some: { status: "SUCCESS" } } } } } };
  return {};
}
