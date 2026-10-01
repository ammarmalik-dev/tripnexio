import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import {
  PaymentMethod,
  PaymentPurpose,
  ServiceType,
  type PaymentMethod as PaymentMethodType,
  type PaymentPurpose as PaymentPurposeType,
  type ServiceType as ServiceTypeType,
} from "../../generated/prisma/enums";
import { serviceTypeCondition, type ServiceScopeCheckable } from "../auth/service-scope";
import {
  INVOICE_REFUND_STATES,
  INVOICE_SORTS,
  financialYearRange,
  invoiceNumberPrefix,
  isValidFinancialYear,
} from "./invoice-filters";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const methodValues = Object.values(PaymentMethod) as [PaymentMethodType, ...PaymentMethodType[]];
const purposeValues = Object.values(PaymentPurpose) as [PaymentPurposeType, ...PaymentPurposeType[]];

/** Every sequential (P07) invoice number starts with "INV-20" + the FY; legacy random ones don't. */
const SEQUENTIAL_INVOICE_PREFIX = "INV-20";

const isoInstant = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date.");

/** An empty query-string value (e.g. `?method=`) means "not filtered", same as leaving it out. */
function optionalParam<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema.optional());
}

/**
 * Invoice History query — shared by GET /api/invoices, /api/invoices/export
 * and /api/invoices/download so the list, the CSV register and the ZIP
 * always cover exactly the same set.
 */
export const invoiceQuerySchema = z.object({
  /** Invoice number, booking id, lead reference, customer name/mobile/email. */
  search: optionalParam(z.string().trim().min(1).max(100)),
  serviceType: optionalParam(z.enum(serviceTypeValues)),
  method: optionalParam(z.enum(methodValues)),
  purpose: optionalParam(z.enum(purposeValues)),
  refundState: optionalParam(z.enum(INVOICE_REFUND_STATES)),
  financialYear: optionalParam(z.string().trim().refine(isValidFinancialYear, "Use the form 2026-27.")),
  /** Issued-date range (Payment.updatedAt — the date printed on the invoice PDF), inclusive. */
  dateFrom: optionalParam(isoInstant),
  dateTo: optionalParam(isoInstant),
  sort: optionalParam(z.enum(INVOICE_SORTS)).transform((value) => value ?? "date_desc"),
  page: optionalParam(z.coerce.number().int().min(1)).transform((value) => value ?? 1),
  pageSize: optionalParam(z.coerce.number().int().min(1).max(100)).transform((value) => value ?? 10),
});

export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;

/**
 * The Prisma `where` for an invoice query: SUCCESS payments only, inside
 * the caller's service scope, plus every filter that can be expressed in
 * SQL. `refundState` "partial"/"full" depend on summed COMPLETED refunds
 * vs. the computed total, so they are narrowed here to "has a completed
 * refund" and finished by the caller (see invoice-register.ts);
 * "none" is exact here.
 */
export function buildInvoiceWhere(
  session: ServiceScopeCheckable,
  query: InvoiceQuery,
  timezoneOffsetMinutes: number
): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [];

  if (query.search) {
    const contains = { contains: query.search, mode: "insensitive" as const };
    and.push({
      OR: [
        { invoiceNumber: contains },
        { booking: { bookingId: contains } },
        { booking: { lead: { reference: contains } } },
        { booking: { customer: { name: contains } } },
        { booking: { customer: { mobile: contains } } },
        { booking: { customer: { email: contains } } },
      ],
    });
  }

  if (query.financialYear) {
    // A sequential invoice (INV-2026-27-0001) belongs to the FY in its
    // number. An unnumbered one, or a legacy pre-P07 number with no year in
    // it (INV-E3JUGSJJ), falls back to its issued date.
    const { start, end } = financialYearRange(query.financialYear, timezoneOffsetMinutes);
    and.push({
      OR: [
        { invoiceNumber: { startsWith: invoiceNumberPrefix(query.financialYear) } },
        {
          AND: [
            { OR: [{ invoiceNumber: null }, { NOT: { invoiceNumber: { startsWith: SEQUENTIAL_INVOICE_PREFIX } } }] },
            { updatedAt: { gte: start, lt: end } },
          ],
        },
      ],
    });
  }

  if (query.dateFrom || query.dateTo) {
    and.push({
      updatedAt: {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      },
    });
  }

  if (query.refundState === "none") {
    and.push({ refunds: { none: { status: "COMPLETED" } } });
  } else if (query.refundState) {
    and.push({ refunds: { some: { status: "COMPLETED" } } });
  }

  return {
    status: "SUCCESS",
    booking: { lead: serviceTypeCondition(session, query.serviceType) },
    ...(query.method ? { method: query.method } : {}),
    ...(query.purpose ? { purpose: query.purpose } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}
