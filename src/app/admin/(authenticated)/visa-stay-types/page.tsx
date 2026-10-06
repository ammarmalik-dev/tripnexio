import type { Metadata } from "next";
import { VisaMasterManager } from "@/components/admin/VisaMasterManager";

export const metadata: Metadata = { title: "Visa Stay Types | Admin" };

export default function AdminVisaStayTypesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Visa Stay Types</h1>
        <p className="text-sm text-ink-tertiary">Stay durations New Visa products can offer (e.g. 30 Days).</p>
      </div>
      <VisaMasterManager kind="stay-types" />
    </div>
  );
}
