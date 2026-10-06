import type { Metadata } from "next";
import { VisaMasterManager } from "@/components/admin/VisaMasterManager";

export const metadata: Metadata = { title: "Visa Validity Types | Admin" };

export default function AdminVisaValidityTypesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Visa Validity Types</h1>
        <p className="text-sm text-ink-tertiary">How long a visa stays valid for entry, chosen on New Visa products.</p>
      </div>
      <VisaMasterManager kind="validity-types" />
    </div>
  );
}
