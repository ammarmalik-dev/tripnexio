import type { Metadata } from "next";
import { NationalitiesManager } from "@/components/admin/NationalitiesManager";

export const metadata: Metadata = { title: "Nationalities | Admin" };

export default function AdminNationalitiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Nationalities</h1>
        <p className="text-sm text-ink-tertiary">
          The nationality picker on the Visa Change form. Pricing rules and document requirements can target a
          nationality from this list. Hide a nationality instead of removing it — existing records keep it.
        </p>
      </div>
      <NationalitiesManager />
    </div>
  );
}
