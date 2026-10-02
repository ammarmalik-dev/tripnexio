"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface ConfigData {
  id: string;
  companyName: string | null;
  companyTagline: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWhatsapp: string | null;
  emailFooterText: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialLinkedin: string | null;
  socialX: string | null;
  socialThreads: string | null;
  currencyCode: string;
  timezoneOffsetMinutes: number;
  documentRetentionDays: number;
  auditRetentionDays: number | null;
  backupRetentionDays: number | null;
  backupScheduleNote: string | null;
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string | null;
  systemAlertEmail: string | null;
  legalEntityName: string | null;
  gstin: string | null;
  jurisdiction: string | null;
  grievanceOfficerName: string | null;
  grievanceEmail: string | null;
  grievancePhone: string | null;
  grievanceAddress: string | null;
  weekendDaysIndia: string;
  weekendDaysUae: string;
  workdayStartHour: number;
  workdayEndHour: number;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWhatsapp: string;
  emailFooterText: string;
  socialInstagram: string;
  socialFacebook: string;
  socialLinkedin: string;
  socialX: string;
  socialThreads: string;
  currencyCode: string;
  timezoneOffsetMinutes: string;
  weekendDaysIndia: string;
  weekendDaysUae: string;
  workdayStartHour: string;
  workdayEndHour: string;
  documentRetentionDays: string;
  auditRetentionDays: string;
  backupRetentionDays: string;
  backupScheduleNote: string;
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string;
  systemAlertEmail: string;
  legalEntityName: string;
  gstin: string;
  jurisdiction: string;
  grievanceOfficerName: string;
  grievanceEmail: string;
  grievancePhone: string;
  grievanceAddress: string;
}

function toFormState(c: ConfigData): FormState {
  return {
    companyName: c.companyName ?? "",
    companyTagline: c.companyTagline ?? "",
    companyAddress: c.companyAddress ?? "",
    companyPhone: c.companyPhone ?? "",
    companyEmail: c.companyEmail ?? "",
    companyWhatsapp: c.companyWhatsapp ?? "",
    emailFooterText: c.emailFooterText ?? "",
    socialInstagram: c.socialInstagram ?? "",
    socialFacebook: c.socialFacebook ?? "",
    socialLinkedin: c.socialLinkedin ?? "",
    socialX: c.socialX ?? "",
    socialThreads: c.socialThreads ?? "",
    currencyCode: c.currencyCode,
    timezoneOffsetMinutes: String(c.timezoneOffsetMinutes),
    weekendDaysIndia: c.weekendDaysIndia,
    weekendDaysUae: c.weekendDaysUae,
    workdayStartHour: String(c.workdayStartHour),
    workdayEndHour: String(c.workdayEndHour),
    documentRetentionDays: String(c.documentRetentionDays),
    auditRetentionDays: c.auditRetentionDays === null ? "" : String(c.auditRetentionDays),
    backupRetentionDays: c.backupRetentionDays === null ? "" : String(c.backupRetentionDays),
    backupScheduleNote: c.backupScheduleNote ?? "",
    maintenanceModeEnabled: c.maintenanceModeEnabled,
    maintenanceMessage: c.maintenanceMessage ?? "",
    systemAlertEmail: c.systemAlertEmail ?? "",
    legalEntityName: c.legalEntityName ?? "",
    gstin: c.gstin ?? "",
    jurisdiction: c.jurisdiction ?? "",
    grievanceOfficerName: c.grievanceOfficerName ?? "",
    grievanceEmail: c.grievanceEmail ?? "",
    grievancePhone: c.grievancePhone ?? "",
    grievanceAddress: c.grievanceAddress ?? "",
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
    companyWhatsapp: form.companyWhatsapp,
    emailFooterText: form.emailFooterText,
    socialInstagram: form.socialInstagram,
    socialFacebook: form.socialFacebook,
    socialLinkedin: form.socialLinkedin,
    socialX: form.socialX,
    socialThreads: form.socialThreads,
    currencyCode: form.currencyCode,
    timezoneOffsetMinutes: Number(form.timezoneOffsetMinutes),
    weekendDaysIndia: form.weekendDaysIndia.trim(),
    weekendDaysUae: form.weekendDaysUae.trim(),
    workdayStartHour: Number(form.workdayStartHour),
    workdayEndHour: Number(form.workdayEndHour),
    documentRetentionDays: Number(form.documentRetentionDays),
    auditRetentionDays: toNullableInt(form.auditRetentionDays),
    backupRetentionDays: toNullableInt(form.backupRetentionDays),
    backupScheduleNote: form.backupScheduleNote,
    maintenanceModeEnabled: form.maintenanceModeEnabled,
    maintenanceMessage: form.maintenanceMessage,
    systemAlertEmail: form.systemAlertEmail,
    legalEntityName: form.legalEntityName,
    gstin: form.gstin,
    jurisdiction: form.jurisdiction,
    grievanceOfficerName: form.grievanceOfficerName,
    grievanceEmail: form.grievanceEmail,
    grievancePhone: form.grievancePhone,
    grievanceAddress: form.grievanceAddress,
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
  const { confirm, dialog } = useConfirmAction();
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
    // P27 - changing the retention period changes when every document file is deleted.
    let reason: string | undefined;
    if (config && Number(form.documentRetentionDays) !== config.documentRetentionDays) {
      const answer = await confirm({
        title: "Change the document retention period?",
        description: `All documents (passport, visa, tickets, bank slips and delivered PDFs) will be deleted ${form.documentRetentionDays} days after their case is closed, instead of ${config.documentRetentionDays}. A shorter period can delete files on the next daily run.`,
        confirmLabel: "Change retention",
      });
      if (!answer) return;
      reason = answer;
    }
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ConfigData>("/api/admin/system-config", { ...buildPayload(form), ...(reason ? { reason } : {}) });
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
      <Section title="Company Information & Branding" description="Leave a field blank to keep using the site's default. Used across the website (header, footer, Contact and support pages), page titles and every invoice PDF.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Company Name" name="companyName" placeholder="Uses site default" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} error={errors.companyName?.[0]} disabled={saving} />
          <TextField label="Tagline" name="companyTagline" placeholder="Uses site default" value={form.companyTagline} onChange={(e) => setForm({ ...form, companyTagline: e.target.value })} error={errors.companyTagline?.[0]} disabled={saving} />
          <TextField label="Address" name="companyAddress" placeholder="Uses site default" value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} error={errors.companyAddress?.[0]} disabled={saving} />
          <TextField label="Phone" name="companyPhone" placeholder="Uses site default" value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} error={errors.companyPhone?.[0]} disabled={saving} />
          <TextField label="Email" name="companyEmail" placeholder="Uses site default" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} error={errors.companyEmail?.[0]} disabled={saving} />
        </div>
      </Section>

      <Section
        title="WhatsApp & Social Links"
        description="Shown in the navbar, mobile menu, footer, Contact and support pages, and in WhatsApp bot replies. Leave blank to keep the site's default."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="WhatsApp Number" name="companyWhatsapp" placeholder="Uses the phone number above" hint="With country code, e.g. +91 92381 84005" value={form.companyWhatsapp} onChange={(e) => setForm({ ...form, companyWhatsapp: e.target.value })} error={errors.companyWhatsapp?.[0]} disabled={saving} />
          <TextField label="Instagram" name="socialInstagram" placeholder="Uses site default" value={form.socialInstagram} onChange={(e) => setForm({ ...form, socialInstagram: e.target.value })} error={errors.socialInstagram?.[0]} disabled={saving} />
          <TextField label="Facebook" name="socialFacebook" placeholder="Uses site default" value={form.socialFacebook} onChange={(e) => setForm({ ...form, socialFacebook: e.target.value })} error={errors.socialFacebook?.[0]} disabled={saving} />
          <TextField label="LinkedIn" name="socialLinkedin" placeholder="Uses site default" value={form.socialLinkedin} onChange={(e) => setForm({ ...form, socialLinkedin: e.target.value })} error={errors.socialLinkedin?.[0]} disabled={saving} />
          <TextField label="X (Twitter)" name="socialX" placeholder="Uses site default" value={form.socialX} onChange={(e) => setForm({ ...form, socialX: e.target.value })} error={errors.socialX?.[0]} disabled={saving} />
          <TextField label="Threads" name="socialThreads" placeholder="Uses site default" value={form.socialThreads} onChange={(e) => setForm({ ...form, socialThreads: e.target.value })} error={errors.socialThreads?.[0]} disabled={saving} />
        </div>
      </Section>
      <Section title="Email Footer" description="Added to the bottom of every email the system sends (customer notifications, OTP, password reset, staff messages, system alerts).">
        <Textarea
          label="Disclaimer text"
          name="emailFooterText"
          rows={3}
          placeholder="This is an automatically generated email. Please do not reply to this message. For any queries, feedback or suggestions, please contact our support team at support@tripnexio.com or call (the phone number above)."
          hint="Leave blank to use the default text shown here, with the phone number above."
          value={form.emailFooterText}
          onChange={(e) => setForm({ ...form, emailFooterText: e.target.value })}
          error={errors.emailFooterText?.[0]}
          disabled={saving}
        />
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

      <Section
        title="Working Calendar"
        description="Used by every working-day rule (OTB timelines, New Visa minimum days, Visa Extension same-day deadline). Public holidays are managed under Holidays."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="India Weekend Days"
            name="weekendDaysIndia"
            hint="Weekday numbers, comma separated: 0 = Sunday, 6 = Saturday. e.g. 0,6"
            value={form.weekendDaysIndia}
            onChange={(e) => setForm({ ...form, weekendDaysIndia: e.target.value })}
            error={errors.weekendDaysIndia?.[0]}
            disabled={saving}
          />
          <TextField
            label="UAE Weekend Days"
            name="weekendDaysUae"
            hint="Weekday numbers, comma separated: 0 = Sunday, 6 = Saturday. e.g. 0,6"
            value={form.weekendDaysUae}
            onChange={(e) => setForm({ ...form, weekendDaysUae: e.target.value })}
            error={errors.weekendDaysUae?.[0]}
            disabled={saving}
          />
          <TextField
            label="Working Day Starts (hour)"
            name="workdayStartHour"
            type="number"
            hint="24-hour clock, local time. e.g. 9"
            value={form.workdayStartHour}
            onChange={(e) => setForm({ ...form, workdayStartHour: e.target.value })}
            error={errors.workdayStartHour?.[0]}
            disabled={saving}
          />
          <TextField
            label="Working Day Ends (hour)"
            name="workdayEndHour"
            type="number"
            hint="24-hour clock, local time. e.g. 18"
            value={form.workdayEndHour}
            onChange={(e) => setForm({ ...form, workdayEndHour: e.target.value })}
            error={errors.workdayEndHour?.[0]}
            disabled={saving}
          />
        </div>
      </Section>

      <Section title="Data Retention">
        {dialog}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Document Retention (days)"
            name="documentRetentionDays"
            type="number"
            hint="All documents are deleted this many days after the case is closed."
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

      <Section
        title="Legal & Grievance Details"
        description="Shown on Contact, Terms and Grievance Redressal only once filled in — leave blank until the final details are confirmed. Support email, phone/WhatsApp and address are the Company fields above."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Business / Legal Entity Name"
            name="legalEntityName"
            placeholder="Not set"
            value={form.legalEntityName}
            onChange={(e) => setForm({ ...form, legalEntityName: e.target.value })}
            error={errors.legalEntityName?.[0]}
            disabled={saving}
          />
          <TextField
            label="GSTIN"
            name="gstin"
            placeholder="Not set"
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            error={errors.gstin?.[0]}
            disabled={saving}
          />
          <TextField
            label="Jurisdiction (courts/authorities)"
            name="jurisdiction"
            placeholder="Not set"
            value={form.jurisdiction}
            onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
            error={errors.jurisdiction?.[0]}
            disabled={saving}
          />
          <TextField
            label="Grievance Officer Name"
            name="grievanceOfficerName"
            placeholder="Not set"
            value={form.grievanceOfficerName}
            onChange={(e) => setForm({ ...form, grievanceOfficerName: e.target.value })}
            error={errors.grievanceOfficerName?.[0]}
            disabled={saving}
          />
          <TextField
            label="Grievance Email"
            name="grievanceEmail"
            placeholder="Not set"
            value={form.grievanceEmail}
            onChange={(e) => setForm({ ...form, grievanceEmail: e.target.value })}
            error={errors.grievanceEmail?.[0]}
            disabled={saving}
          />
          <TextField
            label="Grievance Phone / WhatsApp"
            name="grievancePhone"
            placeholder="Not set"
            value={form.grievancePhone}
            onChange={(e) => setForm({ ...form, grievancePhone: e.target.value })}
            error={errors.grievancePhone?.[0]}
            disabled={saving}
          />
        </div>
        <Textarea
          label="Grievance Postal Address"
          name="grievanceAddress"
          placeholder="Not set"
          value={form.grievanceAddress}
          onChange={(e) => setForm({ ...form, grievanceAddress: e.target.value })}
          error={errors.grievanceAddress?.[0]}
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
