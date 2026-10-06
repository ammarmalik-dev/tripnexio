import crypto from "crypto";
import type { Metadata } from "next";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { db } from "@/lib/db";
import { invoiceVerifyKey } from "@/lib/invoices/invoice-document";
import { maskName } from "@/lib/track/lookup";
import { formatCurrency } from "@/lib/format-currency";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

export const metadata: Metadata = { title: "Verify Invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface VerifyInvoicePageProps {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ k?: string }>;
}

function keyMatches(invoiceNumber: string, key: string | undefined): boolean {
  const expected = invoiceVerifyKey(invoiceNumber);
  if (!expected || !key || key.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected));
}

/**
 * Client corrections 2026-10-05 — the invoice's "Scan to verify" QR opens
 * this page. Only a link carrying the invoice's keyed hash is answered (so
 * invoice numbers can't be guessed), and it shows just enough to confirm the
 * invoice is genuine: number, date, service, amount and a masked name.
 */
export default async function VerifyInvoicePage({ params, searchParams }: VerifyInvoicePageProps) {
  const { number } = await params;
  const { k } = await searchParams;
  const invoiceNumber = decodeURIComponent(number);

  const payment = keyMatches(invoiceNumber, k)
    ? await db.payment.findUnique({
        where: { invoiceNumber },
        select: {
          status: true,
          updatedAt: true,
          amount: true,
          couponDiscount: true,
          gstAmount: true,
          gatewayFee: true,
          booking: { select: { bookingId: true, customer: { select: { name: true } }, lead: { select: { serviceType: true } } } },
        },
      })
    : null;
  const valid = payment !== null && payment.status === "SUCCESS";
  const total = payment
    ? Number(payment.amount) - Number(payment.couponDiscount ?? 0) + Number(payment.gstAmount) + Number(payment.gatewayFee)
    : 0;

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-1 p-6 shadow-sm">
        {valid && payment ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <BadgeCheck className="h-8 w-8 text-success" aria-hidden="true" />
              <div>
                <h1 className="text-lg font-semibold text-ink-heading">Genuine TripNexio invoice</h1>
                <p className="text-sm text-ink-tertiary">This invoice was issued by TripNexio and the payment was received.</p>
              </div>
            </div>
            <dl className="flex flex-col divide-y divide-hairline text-sm">
              {[
                ["Invoice No.", invoiceNumber],
                ["Invoice Date", payment.updatedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
                ["Booking ID", payment.booking.bookingId],
                ["Service", SERVICE_TYPE_LABELS[payment.booking.lead.serviceType]],
                ["Billed To", maskName(payment.booking.customer.name)],
                ["Amount", formatCurrency(total)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-ink-tertiary">{label}</dt>
                  <dd className="font-medium text-ink-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-warning" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold text-ink-heading">Couldn&apos;t verify this invoice</h1>
              <p className="text-sm text-ink-tertiary">
                Scan the QR code on the invoice again, or contact TripNexio support with the invoice number.
              </p>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
