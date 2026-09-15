"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, PlugZap } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
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

/**
 * Step 25 (audit §4.5) — sits above AutomationMonitor on the same Admin
 * Automation page, per-integration connection health (configured vs mock,
 * last success, last error). See GET /api/admin/integrations-health for
 * where each signal actually comes from.
 */
export function IntegrationsHealth() {
  const [state, setState] = useState<FetchState>("loading");
  const [integrations, setIntegrations] = useState<IntegrationHealthData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<{ integrations: IntegrationHealthData[] }>("/api/admin/integrations-health");
        if (cancelled) return;
        setIntegrations(result.integrations);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {integrations.map((integration) => (
        <IntegrationCard key={integration.key} integration={integration} />
      ))}
    </div>
  );
}
