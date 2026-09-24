"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface RuleConfig {
  thirtyDayOffsetDays: number;
  sixtyDayOffsetDays: number;
  ninetyDayOffsetDays: number;
}

export function ReturnTicketRuleConfigManager() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [config, setConfig] = useState<RuleConfig | null>(null);
  const [thirty, setThirty] = useState("");
  const [sixty, setSixty] = useState("");
  const [ninety, setNinety] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<RuleConfig>("/api/admin/return-ticket-rule-config");
        if (cancelled) return;
        setConfig(result);
        setThirty(String(result.thirtyDayOffsetDays));
        setSixty(String(result.sixtyDayOffsetDays));
        setNinety(String(result.ninetyDayOffsetDays));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this configuration. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") return <Skeleton className="h-40 w-full" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the Return Ticket offsets"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const dirty =
    config !== null &&
    (Number(thirty) !== config.thirtyDayOffsetDays || Number(sixty) !== config.sixtyDayOffsetDays || Number(ninety) !== config.ninetyDayOffsetDays);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<RuleConfig>("/api/admin/return-ticket-rule-config", {
        thirtyDayOffsetDays: Number(thirty),
        sixtyDayOffsetDays: Number(sixty),
        ninetyDayOffsetDays: Number(ninety),
      });
      setConfig(updated);
      toast.success("Return Ticket return-date offsets updated.");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          label="30-day validity offset (days)"
          name="thirtyDayOffsetDays"
          type="number"
          min={1}
          value={thirty}
          onChange={(event) => setThirty(event.target.value)}
          error={errors.thirtyDayOffsetDays?.[0]}
          disabled={saving}
        />
        <TextField
          label="60-day validity offset (days)"
          name="sixtyDayOffsetDays"
          type="number"
          min={1}
          value={sixty}
          onChange={(event) => setSixty(event.target.value)}
          error={errors.sixtyDayOffsetDays?.[0]}
          disabled={saving}
        />
        <TextField
          label="90-day validity offset (days)"
          name="ninetyDayOffsetDays"
          type="number"
          min={1}
          value={ninety}
          onChange={(event) => setNinety(event.target.value)}
          error={errors.ninetyDayOffsetDays?.[0]}
          disabled={saving}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
