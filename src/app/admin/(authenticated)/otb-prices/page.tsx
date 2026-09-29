import type { Metadata } from "next";
import { OtbPricesManager } from "@/components/admin/OtbPricesManager";

export const metadata: Metadata = { title: "OTB Prices | Admin" };

export default function AdminOtbPricesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">OTB Prices</h1>
        <p className="text-sm text-ink-tertiary">
          Set the OTB price per airline, destination country and passenger type. Where no active price matches, the
          airline&apos;s own normal / urgent price (Airlines) is charged. The lowest active price is shown on the OTB
          service card as &ldquo;Starting from&rdquo;.
        </p>
      </div>
      <OtbPricesManager />
    </div>
  );
}
