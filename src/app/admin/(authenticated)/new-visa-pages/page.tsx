import type { Metadata } from "next";
import { NewVisaCountryPagesManager } from "@/components/admin/NewVisaCountryPagesManager";

export const metadata: Metadata = { title: "New Visa Country Pages | Admin" };

export default function AdminNewVisaPagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">New Visa Country Pages</h1>
        <p className="text-sm text-ink-tertiary">
          Each published country gets a card on the New Visa page and its own page at /services/new-visa/&lt;address&gt;. Its
          &ldquo;Apply&rdquo; button opens the request form with that country already selected.
        </p>
      </div>
      <NewVisaCountryPagesManager />
    </div>
  );
}
