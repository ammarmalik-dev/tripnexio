"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, PlugZap, XCircle, Rocket } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { GoLiveBadge } from "@/components/admin/GoLiveBadge";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface IntegrationEvent {
  at: string;
  detail: string;
}

interface IntegrationHealthData {
  key: string;
  label: string;
  configured: boolean;
  lastSuccess: IntegrationEvent | null;
  lastError: IntegrationEvent | null;
}

interface GoLiveCheckData {
  key: string;
  group: string;
  label: string;
  ok: boolean;
  detail: string;
  fixHint: string;
}

interface GoLiveStateData {
  ready: boolean;
  markedAt: string | null;
  markedByName: string | null;
}

interface IntegrationsHealthResponse {
  integrations: IntegrationHealthData[];
  checks: GoLiveCheckData[];
  goLive: GoLiveStateData;
  allChecksPassing: boolean;
  canMarkGoLive: boolean;
}

type FetchState = "loading" | "success" | "error";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        configured ? "bg-success/10 text-success" : "bg-ink-primary/[0.06] text-ink-tertiary"
      )}
    >
      <PlugZap className="h-3.5 w-3.5" aria-hidden="true" />
      {configured ? "Configured" : "Mock / Not Configured"}
    </span>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationHealthData }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-heading">{integration.label}</p>
        <ConfiguredBadge configured={integration.configured} />
      </div>

      <div className="mt-1 flex flex-col gap-2 text-xs">
        <div className="flex items-start gap-1.5">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
          {integration.lastSuccess ? (
            <span className="text-ink-tertiary">
              Last success: <span className="text-ink-secondary">{formatDateTime(integration.lastSuccess.at)}</span> —{" "}
              {integration.lastSuccess.detail}
            </span>
          ) : (
            <span className="text-ink-tertiary">No successful calls recorded yet.</span>
          )}
        </div>
        <div className="flex items-start gap-1.5">
          <AlertCircle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", integration.lastError ? "text-error" : "text-ink-tertiary")} aria-hidden="true" />
          {integration.lastError ? (
            <span className="text-error">
              Last error: <span className="font-medium">{formatDateTime(integration.lastError.at)}</span> — {integration.lastError.detail}
            </span>
          ) : (
            <span className="text-ink-tertiary">No errors recorded.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: GoLiveCheckData }) {
  return (
    <li className="flex items-start gap-2.5 py-2.5">
      {check.ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm text-ink-primary">
          <span className="sr-only">{check.ok ? "Passing: " : "Failing: "}</span>
          {check.label}
        </p>
        <p className={cn("text-xs", check.ok ? "text-ink-tertiary" : "text-error")}>{check.detail}</p>
        {check.ok ? null : <p className="text-xs text-ink-secondary">Fix: {check.fixHint}</p>}
      </div>
    </li>
  );
}

interface GoLivePanelProps {
  checks: GoLiveCheckData[];
  goLive: GoLiveStateData;
  allChecksPassing: boolean;
  canMarkGoLive: boolean;
  onGoLiveChanged: (next: GoLiveStateData) => void;
}

/**
 * P26 — every go-live check as a hard green/red row with a fix hint, plus
 * the "Go-live ready" flag. The server re-runs every check before accepting
 * ready=true (409 otherwise), so the disabled button here is a courtesy.
 */
function GoLivePanel({ checks, goLive, allChecksPassing, canMarkGoLive, onGoLiveChanged }: GoLivePanelProps) {
  const { confirm, dialog } = useConfirmAction();
  const [saving, setSaving] = useState(false);
  const failingCount = checks.filter((check) => !check.ok).length;
  const groups = Array.from(new Set(checks.map((check) => check.group)));

  const handleToggle = async () => {
    const nextReady = !goLive.ready;
    const reason = await confirm({
      title: nextReady ? "Mark the system go-live ready?" : "Clear the go-live ready flag?",
      description: nextReady
        ? "Every check is green. This records that TripNexio is ready for real customers."
        : "This marks the system as not ready for go-live. It can be marked ready again once every check is green.",
      confirmLabel: nextReady ? "Mark Ready" : "Clear Flag",
    });
    if (!reason) return;
    setSaving(true);
    try {
      const result = await patchJson<{ goLive: GoLiveStateData }>("/api/admin/integrations-health/go-live", { ready: nextReady, reason });
      onGoLiveChanged(result.goLive);
      toast.success(result.goLive.ready ? "Marked go-live ready." : "Go-live flag cleared.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the go-live flag. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Rocket className="h-4 w-4 text-ink-accent" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink-heading">Go-live readiness</h2>
            <GoLiveBadge ready={goLive.ready} />
          </div>
          <p className="text-xs text-ink-tertiary">
            {failingCount === 0 ? "All checks are green." : `${failingCount} of ${checks.length} checks are failing.`}
            {goLive.markedAt
              ? ` Flag last changed ${formatDateTime(goLive.markedAt)}${goLive.markedByName ? ` by ${goLive.markedByName}` : ""}.`
              : ""}
          </p>
        </div>
        {canMarkGoLive ? (
          <Button
            type="button"
            size="sm"
            variant={goLive.ready ? "ghost" : "primary"}
            isLoading={saving}
            disabled={saving || (!goLive.ready && !allChecksPassing)}
            onClick={() => void handleToggle()}
          >
            {goLive.ready ? "Clear go-live flag" : "Mark go-live ready"}
          </Button>
        ) : null}
      </div>
      {!goLive.ready && !allChecksPassing ? (
        <p className="text-xs text-ink-tertiary">Fix every red check below before the system can be marked go-live ready.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group} className="flex flex-col">
            <h3 className="mt-2 text-xs font-semibold tracking-wide text-ink-tertiary uppercase">{group}</h3>
            <ul className="divide-y divide-hairline">
              {checks
                .filter((check) => check.group === group)
                .map((check) => (
                  <CheckRow key={check.key} check={check} />
                ))}
            </ul>
          </div>
        ))}
      </div>
      {dialog}
    </div>
  );
}

/**
 * Step 25 (audit §4.5) — sits above AutomationMonitor on the same Admin
 * Automation page, per-integration connection health (configured vs mock,
 * last success, last error). P26 adds the go-live checklist and flag above
 * the activity cards. See GET /api/admin/integrations-health for where each
 * signal actually comes from.
 */
export function IntegrationsHealth() {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<IntegrationsHealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<IntegrationsHealthResponse>("/api/admin/integrations-health");
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load integration health. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <ErrorState
        title="Couldn't load integration health"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GoLivePanel
        checks={data.checks}
        goLive={data.goLive}
        allChecksPassing={data.allChecksPassing}
        canMarkGoLive={data.canMarkGoLive}
        onGoLiveChanged={(goLive) => setData((current) => (current ? { ...current, goLive } : current))}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.integrations.map((integration) => (
          <IntegrationCard key={integration.key} integration={integration} />
        ))}
      </div>
    </div>
  );
}
