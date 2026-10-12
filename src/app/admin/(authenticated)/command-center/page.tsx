import type { Metadata } from "next";
import Link from "next/link";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";
import { GoLiveBadge } from "@/components/admin/GoLiveBadge";
import { getGoLiveChecks, getGoLiveState, type GoLiveCheck } from "@/lib/admin/go-live-checks";

export const metadata: Metadata = { title: "AI Command Center | Admin" };

async function loadGoLive(): Promise<{ ready: boolean; failing: GoLiveCheck[] } | null> {
  try {
    const { ready } = await getGoLiveState();
    const failing = ready ? [] : (await getGoLiveChecks()).filter((check) => !check.ok);
    return { ready, failing };
  } catch (error) {
    console.error("[admin/command-center] go-live state failed", error);
    return null;
  }
}

export default async function AdminCommandCenterPage() {
  // P26 — the go-live flag set on Admin → Integrations (Automation page); a small badge only, never blocks the page.
  // Client testing 2026-10-09 (F1): "Not go-live ready" read as an error, so the page now says
  // what is still open and where to finish it. The AI assistant itself works either way.
  const goLive = await loadGoLive();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-heading">AI Command Center</h1>
          {goLive === null ? null : (
            <Link href="/admin/automation" className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <GoLiveBadge ready={goLive.ready} />
            </Link>
          )}
        </div>
        <p className="text-sm text-ink-tertiary">
          Ask a question in plain language — bookings, refunds, staff workload, integration health, pricing changes.
          Read-only for now: it can look things up, but can&apos;t create, change, or disable anything yet.
        </p>
      </div>
      {goLive && !goLive.ready ? <GoLiveNotice failing={goLive.failing} /> : null}
      <AdminCommandCenter />
    </div>
  );
}

/**
 * Why the badge says "Not go-live ready": the launch checklist on Admin →
 * Automation isn't finished yet. Only labels and fix hints are shown, never
 * a secret value.
 */
function GoLiveNotice({ failing }: { failing: GoLiveCheck[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
      <p className="font-semibold text-ink-heading">
        {failing.length === 0
          ? "Every go-live check is green. The system just hasn't been marked go-live ready yet."
          : `The go-live checklist has ${failing.length} item${failing.length === 1 ? "" : "s"} still open.`}
      </p>
      <p className="text-ink-secondary">
        This is a launch checklist, not an error. The AI assistant below works normally.
      </p>
      {failing.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-secondary">
          {failing.slice(0, 6).map((check) => (
            <li key={check.key}>
              <span className="font-medium text-ink-primary">{check.label}</span>: {check.detail}
            </li>
          ))}
          {failing.length > 6 ? <li>…and {failing.length - 6} more</li> : null}
        </ul>
      ) : null}
      <Link href="/admin/automation" className="w-fit text-sm font-semibold text-ink-accent hover:underline">
        {failing.length === 0 ? "Mark go-live ready" : "Open the go-live checklist"}
      </Link>
    </div>
  );
}
