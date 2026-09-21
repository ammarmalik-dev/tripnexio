"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface Rules {
  standardProcessingDays: number;
  urgentProcessingDays: number | null;
}

export function OtbRulesManager() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [rules, setRules] = useState<Rules | null>(null);
  const [standard, setStandard] = useState("");
  const [urgent, setUrgent] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<Rules>("/api/admin/otb-rules");
        if (cancelled) return;
        setRules(result);
        setStandard(String(result.standardProcessingDays));
        setUrgent(result.urgentProcessingDays === null ? "" : String(result.urgentProcessingDays));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the timelines. Please try again.");
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
        title="Couldn't load the timelines"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const nextUrgent = urgent.trim() === "" ? null : Number(urgent);
  const dirty = rules !== null && (Number(standard) !== rules.standardProcessingDays || nextUrgent !== rules.urgentProcessingDays);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<Rules>("/api/admin/otb-rules", {
        standardProcessingDays: Number(standard),
        urgentProcessingDays: nextUrgent,
      });
      setRules(updated);
      toast.success("OTB timelines updated.");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Standard processing (working days)"
          name="standardProcessingDays"
          type="number"
          min={1}
          value={standard}
          onChange={(event) => setStandard(event.target.value)}
          error={errors.standardProcessingDays?.[0]}
          disabled={saving}
        />
        <TextField
          label="Urgent processing (working days)"
          name="urgentProcessingDays"
          type="number"
          min={0}
          placeholder="Not set"
          hint="Leave blank if there's no minimum for urgent requests."
          value={urgent}
          onChange={(event) => setUrgent(event.target.value)}
          error={errors.urgentProcessingDays?.[0]}
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
