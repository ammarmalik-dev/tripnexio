"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface ConfigData {
  id: string;
  companyName: string | null;
  companyTagline: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  currencyCode: string;
  timezoneOffsetMinutes: number;
  documentRetentionDays: number;
  auditRetentionDays: number | null;
  backupRetentionDays: number | null;
  backupScheduleNote: string | null;
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string | null;
  systemAlertEmail: string | null;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  currencyCode: string;
  timezoneOffsetMinutes: string;
  documentRetentionDays: string;
  auditRetentionDays: string;
  backupRetentionDays: string;
  backupScheduleNote: string;
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string;
  systemAlertEmail: string;
}

function toFormState(c: ConfigData): FormState {
  return {
    companyName: c.companyName ?? "",
    companyTagline: c.companyTagline ?? "",
    companyAddress: c.companyAddress ?? "",
    companyPhone: c.companyPhone ?? "",
    companyEmail: c.companyEmail ?? "",
    currencyCode: c.currencyCode,
    timezoneOffsetMinutes: String(c.timezoneOffsetMinutes),
    documentRetentionDays: String(c.documentRetentionDays),
    auditRetentionDays: c.auditRetentionDays === null ? "" : String(c.auditRetentionDays),
    backupRetentionDays: c.backupRetentionDays === null ? "" : String(c.backupRetentionDays),
    backupScheduleNote: c.backupScheduleNote ?? "",
    maintenanceModeEnabled: c.maintenanceModeEnabled,
    maintenanceMessage: c.maintenanceMessage ?? "",
    systemAlertEmail: c.systemAlertEmail ?? "",
  };
}

function buildPayload(form: FormState) {
  const toNullableInt = (value: string) => (value.trim() === "" ? null : Number(value));
  return {
    companyName: form.companyName,
    companyTagline: form.companyTagline,
    companyAddress: form.companyAddress,
    companyPhone: form.companyPhone,
    companyEmail: form.companyEmail,
    currencyCode: form.currencyCode,
    timezoneOffsetMinutes: Number(form.timezoneOffsetMinutes),
    documentRetentionDays: Number(form.documentRetentionDays),
    auditRetentionDays: toNullableInt(form.auditRetentionDays),
    backupRetentionDays: toNullableInt(form.backupRetentionDays),
    backupScheduleNote: form.backupScheduleNote,
    maintenanceModeEnabled: form.maintenanceModeEnabled,
    maintenanceMessage: form.maintenanceMessage,
    systemAlertEmail: form.systemAlertEmail,
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-ink-heading">{title}</h3>
        {description ? <p className="text-xs text-ink-tertiary">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Step 45 (Admin FINAL handover §19). Every field's hint text says exactly
 * whether it has a real wired effect or is informational/captured-only —
 * see SystemConfig's own schema doc comment for the authoritative list.
 */
export function SystemConfigManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<ConfigData>("/api/admin/system-config");
        if (cancelled) return;
        setConfig(result);
        setForm(toFormState(result));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load system configuration. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading" || !form) return <Skeleton className="h-96 w-full" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load system configuration"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!config) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(config));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ConfigData>("/api/admin/system-config", buildPayload(form));
      toast.success("System configuration updated.");
      setConfig(updated);
      setForm(toFormState(updated));
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 rounded-xl border border-hairline bg-surface-1 p-5">
      <Section title="Company Information & Branding" description="Leave a field blank to keep using the site's default. Affects the site's page title/description and every invoice PDF.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Company Name" name="companyName" placeholder="Uses site default" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} error={errors.companyName?.[0]} disabled={saving} />
          <TextField label="Tagline" name="companyTagline" placeholder="Uses site default" value={form.companyTagline} onChange={(e) => setForm({ ...form, companyTagline: e.target.value })} error={errors.companyTagline?.[0]} disabled={saving} />
          <TextField label="Address" name="companyAddress" placeholder="Uses site default" value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} error={errors.companyAddress?.[0]} disabled={saving} />
          <TextField label="Phone" name="companyPhone" placeholder="Uses site default" value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} error={errors.companyPhone?.[0]} disabled={saving} />
          <TextField label="Email" name="companyEmail" placeholder="Uses site default" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} error={errors.companyEmail?.[0]} disabled={saving} />
        </div>
      </Section>

      <Section title="Currency & Timezone">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Currency Code"
            name="currencyCode"
            hint="Display formatting only (e.g. INR) — affects invoice PDF amounts."
            value={form.currencyCode}
            onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
            error={errors.currencyCode?.[0]}
            disabled={saving}
          />
          <TextField
            label="Timezone Offset (minutes from UTC)"
            name="timezoneOffsetMinutes"
            type="number"
            hint="330 = IST. Affects OTB's Urgent-processing working-hours cutoff."
            value={form.timezoneOffsetMinutes}
            onChange={(e) => setForm({ ...form, timezoneOffsetMinutes: e.target.value })}
            error={errors.timezoneOffsetMinutes?.[0]}
            disabled={saving}
          />
        </div>
      </Section>

      <Section title="Data Retention">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Document Retention (days)"
            name="documentRetentionDays"
            type="number"
            hint="Wired into the automated document-purge job."
            value={form.documentRetentionDays}
            onChange={(e) => setForm({ ...form, documentRetentionDays: e.target.value })}
            error={errors.documentRetentionDays?.[0]}
            disabled={saving}
          />
          <TextField
            label="Audit Log Retention (days)"
            name="auditRetentionDays"
            type="number"
            placeholder="Not set"
            hint="Captured only — no purge job exists for audit logs yet."
            value={form.auditRetentionDays}
            onChange={(e) => setForm({ ...form, auditRetentionDays: e.target.value })}
            error={errors.auditRetentionDays?.[0]}
            disabled={saving}
          />
        </div>
      </Section>

      <Section title="Backup" description="Informational/reference only — documents what ops actually runs via cron; not read by the backup script at runtime.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Backup Retention (days)"
            name="backupRetentionDays"
            type="number"
            placeholder="Not set"
            value={form.backupRetentionDays}
            onChange={(e) => setForm({ ...form, backupRetentionDays: e.target.value })}
            error={errors.backupRetentionDays?.[0]}
            disabled={saving}
          />
          <TextField
            label="Backup Schedule (reference note)"
            name="backupScheduleNote"
            placeholder="e.g. Daily at 2:00 AM IST"
            value={form.backupScheduleNote}
            onChange={(e) => setForm({ ...form, backupScheduleNote: e.target.value })}
            error={errors.backupScheduleNote?.[0]}
            disabled={saving}
          />
        </div>
      </Section>

      <Section title="Maintenance Mode" description="Shows a dismissible banner on customer-facing pages only — never blocks /crm, /admin, or the site itself.">
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={form.maintenanceModeEnabled} onChange={(e) => setForm({ ...form, maintenanceModeEnabled: e.target.checked })} disabled={saving} />
          Enable maintenance banner
        </label>
        <Textarea
          label="Maintenance Message"
          name="maintenanceMessage"
          placeholder="We're performing scheduled maintenance — some features may be temporarily slow."
          value={form.maintenanceMessage}
          onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
          error={errors.maintenanceMessage?.[0]}
          disabled={saving}
        />
      </Section>

      <Section title="System Notifications" description="Distinct from customer notifications (Notification Templates) — this alerts staff/ops by email when an automated job fails.">
        <TextField
          label="System Alert Email"
          name="systemAlertEmail"
          placeholder="Not set — alerts disabled"
          value={form.systemAlertEmail}
          onChange={(e) => setForm({ ...form, systemAlertEmail: e.target.value })}
          error={errors.systemAlertEmail?.[0]}
          disabled={saving}
        />
      </Section>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
