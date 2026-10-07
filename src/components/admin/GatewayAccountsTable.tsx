"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface GatewayAccount {
  id: string;
  provider: "RAZORPAY" | "CASHFREE";
  label: string;
  envPrefix: string;
  envVars: string[];
  configured: boolean;
  mode: "Live" | "Test" | "Unknown";
  priority: number;
  active: boolean;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckMessage: string | null;
  attempts30d: number;
  failures30d: number;
}

type Action = "MAKE_PRIMARY" | "MOVE_UP" | "MOVE_DOWN" | "ACTIVATE" | "DEACTIVATE";

const PROVIDER_LABELS = { RAZORPAY: "Razorpay", CASHFREE: "Cashfree" } as const;

function formatTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function HealthPill({ account }: { account: GatewayAccount }) {
  if (!account.configured) return <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">Not configured</span>;
  if (account.lastCheckOk === null) return <span className="rounded-full bg-ink-primary/6 px-2.5 py-1 text-xs font-medium text-ink-tertiary">Not checked</span>;
  return account.lastCheckOk ? (
    <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">Healthy</span>
  ) : (
    <span className="rounded-full bg-error/10 px-2.5 py-1 text-xs font-medium text-error">Failing</span>
  );
}

/**
 * Client corrections 2026-10-05 §27 — the gateway accounts in failover order
 * (Razorpay A → Razorpay B → Cashfree…): provider, label, mode, priority,
 * status, health and last check; Add, Make Primary (switch gateway), move
 * up/down, activate/disable and a health check. Every change asks for a reason
 * and is audited. Credentials stay in env vars — only their NAMES show here.
 */
export function GatewayAccountsTable() {
  const [accounts, setAccounts] = useState<GatewayAccount[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ provider: "RAZORPAY" as GatewayAccount["provider"], label: "", envPrefix: "" });
  const [draftErrors, setDraftErrors] = useState<Record<string, string[] | undefined>>({});
  const { confirm, dialog } = useConfirmAction();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<GatewayAccount[]>("/api/admin/payment-gateway/accounts");
        if (!cancelled) {
          setAccounts(result);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const refresh = () => setReloadNonce((n) => n + 1);

  const runAction = async (account: GatewayAccount, action: Action) => {
    const titles: Record<Action, string> = {
      MAKE_PRIMARY: `Switch the primary gateway to ${account.label}?`,
      MOVE_UP: `Move ${account.label} up the failover order?`,
      MOVE_DOWN: `Move ${account.label} down the failover order?`,
      ACTIVATE: `Activate ${account.label}?`,
      DEACTIVATE: `Disable ${account.label}?`,
    };
    const reason = await confirm({
      title: titles[action],
      description: "New payment links try the active accounts in this order and fail over to the next one if a gateway is unavailable. Existing links are not affected.",
      confirmLabel: "Confirm",
    });
    if (!reason) return;
    setBusy(`${account.id}:${action}`);
    try {
      await patchJson(`/api/admin/payment-gateway/accounts/${account.id}`, { action, reason });
      toast.success("Gateway order updated.");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the gateway. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const checkHealth = async (account: GatewayAccount) => {
    setBusy(`${account.id}:HEALTH`);
    try {
      const result = await postJson<GatewayAccount>(`/api/admin/payment-gateway/accounts/${account.id}/health`, {});
      if (result.lastCheckOk) toast.success(`${account.label} is healthy.`);
      else toast.error(result.lastCheckMessage ?? `${account.label} failed the health check.`);
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't run the health check.");
    } finally {
      setBusy(null);
    }
  };

  const addAccount = async () => {
    const reason = await confirm({
      title: `Add ${draft.label || "this gateway account"}?`,
      description: `It goes to the end of the failover order. Set its keys on the server as ${draft.envPrefix || "<PREFIX>"}_* env vars, then run a health check.`,
      confirmLabel: "Add Account",
    });
    if (!reason) return;
    setBusy("ADD");
    setDraftErrors({});
    try {
      await postJson("/api/admin/payment-gateway/accounts", { ...draft, reason });
      toast.success("Gateway account added.");
      setShowAdd(false);
      setDraft({ provider: "RAZORPAY", label: "", envPrefix: "" });
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setDraftErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add the account.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-heading">Gateway accounts &amp; failover</h2>
          <p className="text-sm text-ink-tertiary">Primary first; if it&rsquo;s unavailable, new payment links fail over to the next active account automatically.</p>
        </div>
        {!showAdd ? (
          <Button type="button" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Gateway
          </Button>
        ) : null}
      </div>

      {showAdd ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-hairline bg-surface-1 p-4 md:grid-cols-[160px_1fr_1fr_auto] md:items-end">
          <FormField label="Provider" htmlFor="gw-provider">
            <select
              id="gw-provider"
              value={draft.provider}
              onChange={(event) => setDraft((current) => ({ ...current, provider: event.target.value as GatewayAccount["provider"] }))}
              className={cn(fieldControlClass, fieldBorderClass(false))}
            >
              <option value="RAZORPAY">Razorpay</option>
              <option value="CASHFREE">Cashfree</option>
            </select>
          </FormField>
          <FormField label="Label" htmlFor="gw-label" error={draftErrors.label?.[0]}>
            <input
              id="gw-label"
              value={draft.label}
              placeholder="e.g. Razorpay Account B"
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              className={cn(fieldControlClass, fieldBorderClass(!!draftErrors.label))}
            />
          </FormField>
          <FormField label="Env prefix" htmlFor="gw-prefix" error={draftErrors.envPrefix?.[0]} hint="Keys are read from <PREFIX>_* env vars.">
            <input
              id="gw-prefix"
              value={draft.envPrefix}
              placeholder={draft.provider === "RAZORPAY" ? "RAZORPAY_B" : "CASHFREE"}
              onChange={(event) => setDraft((current) => ({ ...current, envPrefix: event.target.value.toUpperCase() }))}
              className={cn(fieldControlClass, fieldBorderClass(!!draftErrors.envPrefix), "uppercase")}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void addAccount()} isLoading={busy === "ADD"} disabled={draft.label.trim().length < 2 || draft.envPrefix.trim().length < 2}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <ErrorState
          title="Couldn't load the gateway accounts"
          description="Please try again."
          action={
            <Button type="button" size="sm" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : accounts === null ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : accounts.length === 0 ? (
        <EmptyState title="No gateway accounts" description="Add the first gateway account to start taking payments." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Provider / Account</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Last check / result</th>
                <th className="px-4 py-3">Links (30 days)</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, index) => (
                <tr key={account.id} className="border-b border-hairline align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink-heading">
                      {index + 1}
                      {index === 0 && account.active ? <Star className="h-3.5 w-3.5 fill-current text-warning" aria-label="Primary" /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-primary">{account.label}</p>
                    <p className="text-xs text-ink-tertiary">
                      {PROVIDER_LABELS[account.provider]} · env {account.envVars.join(", ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{account.mode}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        account.active ? "bg-success/10 text-success" : "bg-ink-primary/6 text-ink-tertiary"
                      )}
                    >
                      {account.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HealthPill account={account} />
                  </td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-ink-secondary">
                    <p>{formatTime(account.lastCheckedAt)}</p>
                    {account.lastCheckMessage ? <p className="text-ink-tertiary">{account.lastCheckMessage}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-secondary">
                    {account.attempts30d} tried{account.failures30d > 0 ? <span className="text-error"> · {account.failures30d} failed</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => void checkHealth(account)} isLoading={busy === `${account.id}:HEALTH`} aria-label={`Check ${account.label}`}>
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Check
                      </Button>
                      {index > 0 ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void runAction(account, "MAKE_PRIMARY")} disabled={busy !== null}>
                          Make primary
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => void runAction(account, "MOVE_UP")} disabled={busy !== null || index === 0} aria-label={`Move ${account.label} up`}>
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void runAction(account, "MOVE_DOWN")}
                        disabled={busy !== null || index === accounts.length - 1}
                        aria-label={`Move ${account.label} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void runAction(account, account.active ? "DEACTIVATE" : "ACTIVATE")} disabled={busy !== null}>
                        {account.active ? "Disable" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-tertiary">
        Cashfree webhook URL: <code className="rounded bg-ink-primary/5 px-1">/api/webhooks/cashfree</code> on this site. Razorpay accounts all use{" "}
        <code className="rounded bg-ink-primary/5 px-1">/api/webhooks/razorpay</code>.
      </p>
      {dialog}
    </section>
  );
}
