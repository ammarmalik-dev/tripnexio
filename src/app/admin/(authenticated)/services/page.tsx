import type { Metadata } from "next";
import { ServicesManager } from "@/components/admin/ServicesManager";

export const metadata: Metadata = { title: "Services | Admin" };

export default function AdminServicesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Services</h1>
        <p className="text-sm text-ink-tertiary">
          Edit each service&apos;s display name, description, icon, and order on the website — or temporarily hide
          one. Changes take effect immediately, no deployment needed. A genuinely new service still needs a
          developer to build its request flow first.
        </p>
      </div>
      <ServicesManager />
    </div>
  );
}
