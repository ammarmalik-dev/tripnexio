import type { Metadata } from "next";
import { AirportsManager } from "@/components/admin/AirportsManager";

export const metadata: Metadata = { title: "Airports | Admin" };

export default function AdminAirportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Airports</h1>
        <p className="text-sm text-ink-tertiary">
          Manage the airport master list used for Airport-to-Airport visa change routing. A few clearly-labeled
          SAMPLE rows are seeded for development — propose the real India/GCC list for review before it replaces them.
        </p>
      </div>
      <AirportsManager />
    </div>
  );
}
