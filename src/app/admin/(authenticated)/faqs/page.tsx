import type { Metadata } from "next";
import { FaqsManager } from "@/components/admin/FaqsManager";

export const metadata: Metadata = { title: "FAQs | Admin" };

export default function AdminFaqsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">FAQs</h1>
        <p className="text-sm text-ink-tertiary">
          The single knowledge base used by the website, the CRM, and later the WhatsApp AI. A few clearly-labeled
          SAMPLE entries are seeded for development — propose the real content for review before it replaces them.
        </p>
      </div>
      <FaqsManager />
    </div>
  );
}
