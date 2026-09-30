import type { Metadata } from "next";
import Link from "next/link";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";
import { GoLiveBadge } from "@/components/admin/GoLiveBadge";
import { getGoLiveState } from "@/lib/admin/go-live-checks";

export const metadata: Metadata = { title: "AI Command Center | Admin" };

async function loadGoLiveReady(): Promise<boolean | null> {
  try {
    return (await getGoLiveState()).ready;
  } catch (error) {
    console.error("[admin/command-center] go-live state failed", error);
    return null;
  }
}

export default async function AdminCommandCenterPage() {
  // P26 — the go-live flag set on Admin → Integrations (Automation page); a small badge only, never blocks the page.
  const goLiveReady = await loadGoLiveReady();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-heading">AI Command Center</h1>
          {goLiveReady === null ? null : (
            <Link href="/admin/automation" className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <GoLiveBadge ready={goLiveReady} />
            </Link>
          )}
        </div>
        <p className="text-sm text-ink-tertiary">
          Ask a question in plain language — bookings, refunds, staff workload, integration health, pricing changes.
          Read-only for now: it can look things up, but can&apos;t create, change, or disable anything yet.
        </p>
      </div>
      <AdminCommandCenter />
    </div>
  );
}
