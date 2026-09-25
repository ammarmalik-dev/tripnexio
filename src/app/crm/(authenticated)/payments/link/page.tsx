import type { Metadata } from "next";
import { PaymentLinkLookupForm } from "@/components/crm/PaymentLinkLookupForm";

export const metadata: Metadata = { title: "Payment Link Generation | Internal Dashboard" };

export default function CrmPaymentLinkPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Payment Link Generation</h1>
        <p className="text-sm text-ink-tertiary">
          Search any booking and copy or generate its payment link — for handling a customer over the phone, WhatsApp, or in person.
        </p>
      </div>
      <PaymentLinkLookupForm />
    </div>
  );
}
