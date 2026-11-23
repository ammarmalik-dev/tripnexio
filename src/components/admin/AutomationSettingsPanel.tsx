"use client";

import { useEffect, useState } from "react";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";

type ChannelState = "ON" | "OFF" | "MIXED" | "NONE";

interface AutomationRow {
  key: string;
  label: string;
  description: string;
  audience: "CUSTOMER" | "STAFF";
  enabled: boolean;
  email: ChannelState;
  whatsapp: ChannelState;
}

function Toggle({ label, checked, disabled, onChange, note }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void; note?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
      <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
      {label}
      {note ? <span className="text-ink-tertiary">({note})</span> : null}
    </label>
  );
}

/**
 * Client doc 16 Nov (N1) — every automation's on / off, and for customer automations the Email and WhatsApp
 * channels separately (each channel switches that automation's templates on / off; the wording is edited in
 * Admin → Notification Templates).
 */
export function AutomationSettingsPanel() {
  const [rows, setRows] = useState<AutomationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<AutomationRow[]>("/api/admin/automation-settings");
        if (!cancelled) {
          setRows(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the automation settings.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const change = async (key: string, body: Record<string, unknown>, done: string) => {
    setPending(key);
    try {
      await patchJson("/api/admin/automation-settings", { key, ...body });
      toast.success(done);
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setPending(null);
    }
  };

  if (error) {
    return (
      <ErrorState
        title="Couldn't load the automation settings"
        description={error}
        action={
          <Button type="button" size="sm" onClick={() => setNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!rows) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-secondary">
            <th className="px-4 py-2 font-medium">Automation</th>
            <th className="px-4 py-2 font-medium">On / off</th>
            <th className="px-4 py-2 font-medium">Channels</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-hairline align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-ink-primary">
                  {row.label} <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-normal text-ink-secondary">{row.audience === "CUSTOMER" ? "Customer" : "Staff"}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-tertiary">{row.description}</p>
              </td>
              <td className="px-4 py-3">
                <Toggle
                  label={row.enabled ? "On" : "Off"}
                  checked={row.enabled}
                  disabled={pending === row.key}
                  onChange={() => void change(row.key, { enabled: !row.enabled }, `${row.label} switched ${row.enabled ? "off" : "on"}.`)}
                />
              </td>
              <td className="px-4 py-3">
                {row.audience === "STAFF" ? (
                  <span className="text-xs text-ink-tertiary">Email to staff</span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {(["EMAIL", "WHATSAPP"] as const).map((channel) => {
                      const state = channel === "EMAIL" ? row.email : row.whatsapp;
                      const name = channel === "EMAIL" ? "Email" : "WhatsApp";
                      return (
                        <Toggle
                          key={channel}
                          label={name}
                          checked={state === "ON" || state === "MIXED"}
                          disabled={pending === row.key || state === "NONE"}
                          note={state === "NONE" ? "no template" : state === "MIXED" ? "partly on" : undefined}
                          onChange={() => void change(row.key, { channel, active: state !== "ON" }, `${row.label}: ${name} ${state === "ON" ? "off" : "on"}.`)}
                        />
                      );
                    })}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
