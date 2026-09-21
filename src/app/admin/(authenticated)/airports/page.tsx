import type { Metadata } from "next";
import { AirportsManager } from "@/components/admin/AirportsManager";
import { AirportImportPanel } from "@/components/admin/AirportImportPanel";

export const metadata: Metadata = { title: "Airports | Admin" };

export default function AdminAirportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Airports</h1>
        <p className="text-sm text-ink-tertiary">
          The airport database behind the Special Fare departure/arrival search and Airport-to-Airport visa change
          routing. Add airports one by one below, or bulk-import a CSV. A few clearly-labeled SAMPLE rows are seeded
          for development.
        </p>
      </div>
      <AirportImportPanel />
      <AirportsManager />
    </div>
  );
}
