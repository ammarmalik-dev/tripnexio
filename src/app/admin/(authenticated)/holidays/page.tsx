import type { Metadata } from "next";
import { HolidaysManager } from "@/components/admin/HolidaysManager";

export const metadata: Metadata = { title: "Holidays | Admin" };

export default function AdminHolidaysPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Holidays</h1>
        <p className="text-sm text-ink-tertiary">
          Public holidays and weekly offs for India and each destination country. Processing time (TAT) skips the holidays
          and weekly offs of both India and the destination country. Business hours are set in System Config.
        </p>
      </div>
      <HolidaysManager />
    </div>
  );
}
