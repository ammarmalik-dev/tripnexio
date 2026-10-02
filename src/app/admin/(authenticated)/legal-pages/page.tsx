import type { Metadata } from "next";
import { LegalPagesManager } from "@/components/admin/LegalPagesManager";

export const metadata: Metadata = { title: "Legal Pages | Admin" };

export default function AdminLegalPagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Legal Pages</h1>
        <p className="text-sm text-ink-tertiary">
          Edit About Us and the legal pages. &ldquo;Save &amp; publish&rdquo; updates the live page straight away; &ldquo;Reset to
          original&rdquo; brings back the approved text. Company and contact details are under System Configuration.
        </p>
      </div>
      <LegalPagesManager />
    </div>
  );
}
