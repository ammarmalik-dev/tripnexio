import type { Metadata } from "next";
import { NewVisaCountriesManager } from "@/components/admin/NewVisaCountriesManager";

export const metadata: Metadata = { title: "New Visa Countries | Admin" };

export default function AdminNewVisaCountriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">New Visa Countries</h1>
        <p className="text-sm text-ink-tertiary">
          Add, edit, activate, deactivate and remove the countries New Visa is offered for. Each country connects to the
          central Pricing, Documents and Timeline controls — configure prices and document checklists there, not here.
        </p>
      </div>
      <NewVisaCountriesManager />
    </div>
  );
}
