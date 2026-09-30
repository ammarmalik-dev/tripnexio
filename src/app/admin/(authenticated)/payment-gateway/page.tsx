import type { Metadata } from "next";
import { PaymentGatewayManager } from "@/components/admin/PaymentGatewayManager";

export const metadata: Metadata = { title: "Payment Gateway | Admin" };

export default function AdminPaymentGatewayPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Payment Gateway</h1>
        <p className="text-sm text-ink-tertiary">
          Which gateway is active, whether its keys are configured, the webhook URL to register, and how long new payment
          links stay valid. Secrets are never displayed.
        </p>
      </div>
      <PaymentGatewayManager />
    </div>
  );
}
