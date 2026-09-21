import type { Metadata } from "next";
import { OtbRulesManager } from "@/components/admin/OtbRulesManager";

export const metadata: Metadata = { title: "OTB Processing Timelines | Admin" };

export default function AdminOtbRulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">OTB Processing Timelines</h1>
        <p className="text-sm text-ink-tertiary">
          The default standard and urgent OTB processing times, in working days (Mon-Fri). If a customer&apos;s travel
          date is inside the standard time, the website offers Urgent (when the airline has an urgent price) or stops the
          request. Each airline can override these on the Airlines screen.
        </p>
      </div>
      <OtbRulesManager />
    </div>
  );
}
