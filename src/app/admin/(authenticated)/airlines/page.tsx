import type { Metadata } from "next";
import { AirlinesManager } from "@/components/admin/AirlinesManager";

export const metadata: Metadata = { title: "Airlines | Admin" };

export default function AdminAirlinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Airlines</h1>
        <p className="text-sm text-ink-tertiary">
          Manage the airline master list, including OTB requirements and processing prices. A few clearly-labeled
          SAMPLE rows are seeded for development — propose the real list for review before it replaces them.
        </p>
      </div>
      <AirlinesManager />
    </div>
  );
}
