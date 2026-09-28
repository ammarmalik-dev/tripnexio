import type { Metadata } from "next";
import { HolidaysManager } from "@/components/admin/HolidaysManager";

export const metadata: Metadata = { title: "Holidays | Admin" };

export default function AdminHolidaysPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Holidays</h1>
        <p className="text-sm text-ink-tertiary">
          Public holidays for India and the UAE. Working-day rules (OTB timelines, New Visa minimum days, the Visa
          Extension same-day deadline) skip active holidays. Weekend days and business hours are set in System Config.
        </p>
      </div>
      <HolidaysManager />
    </div>
  );
}
