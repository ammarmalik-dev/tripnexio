import type { Metadata } from "next";
import { VisaMasterManager } from "@/components/admin/VisaMasterManager";

export const metadata: Metadata = { title: "Visa Entry Types | Admin" };

/** Client doc 16 Nov (K8) — the Visa Entry Type master (Single Entry, Multiple Entry, …), chosen on New Visa products. */
export default function AdminVisaEntryTypesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Visa Entry Types</h1>
        <p className="text-sm text-ink-tertiary">Single, multiple or other entry options, chosen on New Visa products.</p>
      </div>
      <VisaMasterManager kind="entry-types" />
    </div>
  );
}
