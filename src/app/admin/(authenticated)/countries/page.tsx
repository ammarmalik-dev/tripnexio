import type { Metadata } from "next";
import { CountriesManager } from "@/components/admin/CountriesManager";

export const metadata: Metadata = { title: "Countries | Admin" };

export default function AdminCountriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Countries</h1>
        <p className="text-sm text-ink-tertiary">
          Manage the country list used for Airport/Border classification and the website&apos;s destination
          selector. Add, rename, reorder, or disable a country here — no code deployment needed.
        </p>
      </div>
      <CountriesManager />
    </div>
  );
}
