import type { Metadata } from "next";
import { VisaTypesManager } from "@/components/admin/VisaTypesManager";

export const metadata: Metadata = { title: "Visa Types | Admin" };

export default function AdminVisaTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Visa Types</h1>
        <p className="text-sm text-ink-tertiary">
          The Visa Type options on the New Visa form and WhatsApp bot. Leave the country as &ldquo;All countries&rdquo; to
          offer a type for every destination. Existing requests keep the visa type they were submitted with.
        </p>
      </div>
      <VisaTypesManager />
    </div>
  );
}
