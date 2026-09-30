import type { Metadata } from "next";
import { OcrMonitor } from "@/components/admin/OcrMonitor";

export const metadata: Metadata = { title: "OCR Monitor | Admin" };

export default function AdminOcrMonitorPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">OCR Monitor</h1>
        <p className="text-sm text-ink-tertiary">
          Passport, ticket, and visa OCR jobs — how many succeeded, are waiting for staff review, were confirmed or rejected, and which
          provider calls failed. Passport jobs can be retried here; ticket and visa documents are re-read by re-uploading the file.
        </p>
      </div>
      <OcrMonitor />
    </div>
  );
}
