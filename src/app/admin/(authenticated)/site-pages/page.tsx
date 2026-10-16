import type { Metadata } from "next";
import { SitePagesManager } from "@/components/admin/SitePagesManager";

export const metadata: Metadata = { title: "Website Pages | Admin" };

/** Client doc 2026-10-15 (J3) — Admin edits the photo and main wording of the Home and service pages. */
export default function AdminSitePagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Website Pages</h1>
        <p className="text-sm text-ink-tertiary">
          The photo, headline, intro, button and How It Works steps of the Home page and each service page. Changes go live as
          soon as you save. New Visa country pages have their own editor (New Visa Country Pages).
        </p>
      </div>
      <SitePagesManager />
    </div>
  );
}
