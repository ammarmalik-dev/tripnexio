import type { Metadata } from "next";
import { OccupationsManager } from "@/components/admin/OccupationsManager";

export const metadata: Metadata = { title: "Occupations | Admin" };

export default function AdminOccupationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Occupations</h1>
        <p className="text-sm text-ink-tertiary">
          The occupation dropdown on the New Visa traveller form. Add, rename, reorder, hide or remove options — changes
          apply to the website immediately. Existing requests keep the occupation they were submitted with.
        </p>
      </div>
      <OccupationsManager />
    </div>
  );
}
