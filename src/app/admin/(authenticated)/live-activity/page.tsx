import type { Metadata } from "next";
import { LiveActivityFeed } from "@/components/admin/LiveActivityFeed";

export const metadata: Metadata = { title: "Live Activity | Admin" };

export default function AdminLiveActivityPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Live Activity</h1>
        <p className="text-sm text-ink-tertiary">
          The latest leads, payments, bookings, WhatsApp conversations, and OCR jobs as they happen. WhatsApp numbers are masked.
        </p>
      </div>
      <LiveActivityFeed />
    </div>
  );
}
