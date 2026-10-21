import type { Metadata } from "next";
import { AirlinesManager } from "@/components/admin/AirlinesManager";
import { CsvImportPanel } from "@/components/admin/CsvImportPanel";

export const metadata: Metadata = { title: "Airlines | Admin" };

export default function AdminAirlinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Airlines</h1>
        <p className="text-sm text-ink-tertiary">
          Manage the airline master list used across flights, OTB and Return Ticket.
        </p>
      </div>
      <CsvImportPanel entity="airlines" />
      <AirlinesManager />
    </div>
  );
}
