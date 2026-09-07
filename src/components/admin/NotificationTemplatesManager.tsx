"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { NOTIFICATION_CHANNEL_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { NotificationChannel } from "../../generated/prisma/enums";

interface TemplateData {
  id: string;
  event: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  event: string;
  channel: NotificationChannel | "";
  subject: string;
  body: string;
}

const EMPTY_FORM: FormState = { event: "", channel: "", subject: "", body: "" };

function toFormState(template: TemplateData): FormState {
  return { event: template.event, channel: template.channel, subject: template.subject ?? "", body: template.body };
}

function buildPayload(form: FormState) {
  return {
    event: form.event.trim(),
    channel: form.channel || undefined,
    subject: form.channel === "EMAIL" && form.subject.trim() !== "" ? form.subject.trim() : undefined,
    body: form.body,
  };
}

function TemplateFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Event"
          name="event"
          placeholder="e.g. LEAD_CREATED"
          value={form.event}
          onChange={(event) => onChange({ ...form, event: event.target.value })}
          error={errors.event?.[0]}
          disabled={disabled}
        />
        <FormField label="Channel" htmlFor="channel" error={errors.channel?.[0]}>
          <select
            id="channel"
            value={form.channel}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, channel: event.target.value as NotificationChannel })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.channel))}
          >
            <option value="" disabled>
              Select a channel
            </option>
            {NOTIFICATION_CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {form.channel === "EMAIL" ? (
        <TextField
          label="Subject"
          name="subject"
          value={form.subject}
          onChange={(event) => onChange({ ...form, subject: event.target.value })}
          error={errors.subject?.[0]}
          disabled={disabled}
        />
      ) : null}
      <Textarea
        label="Message Body"
        name="body"
        rows={5}
        hint="Use {{placeholder}} syntax for variables, e.g. {{customerName}}, {{referenceId}}."
        value={form.body}
        onChange={(event) => onChange({ ...form, body: event.target.value })}
        error={errors.body?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

function TemplateCard({ template, onSaved }: { template: TemplateData; onSaved: (template: TemplateData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(template));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(template));

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      await postJson(`/api/admin/notification-templates/${template.id}/test-send`, { to: testEmail.trim() });
      toast.success(`Test email sent to ${testEmail.trim()}. Check the server console if Resend isn't configured yet.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send a test email. Please try again.");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<TemplateData>(`/api/admin/notification-templates/${template.id}`, buildPayload(form));
      toast.success(`Template "${updated.event}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<TemplateData>(`/api/admin/notification-templates/${template.id}`, { active: !template.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this template. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", template.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {template.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {template.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <TemplateFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      {template.channel === "EMAIL" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          <input
            type="email"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            disabled={dirty || sendingTest}
            className={cn(fieldControlClass, fieldBorderClass(false), "max-w-xs")}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void handleSendTest()}
            isLoading={sendingTest}
            disabled={dirty || !testEmail.trim() || !template.active}
          >
            Send Test
          </Button>
          {dirty ? <span className="text-xs text-ink-tertiary">Save your changes first — this tests the saved template.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function NewTemplateForm({ onCreated }: { onCreated: (template: TemplateData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<TemplateData>("/api/admin/notification-templates", buildPayload(form));
      toast.success(`Template "${created.event}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this template. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.event.trim() && form.channel && form.body.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Notification Template</h2>
      <TemplateFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Template
        </Button>
      </div>
    </div>
  );
}

export function NotificationTemplatesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<TemplateData[]>("/api/admin/notification-templates");
        if (cancelled) return;
        setTemplates(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load notification templates. Please try again.");
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
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load notification templates"
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
      {templates.length === 0 ? (
        <EmptyState title="No notification templates yet" description="Add the first one using the form below." />
      ) : (
        templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSaved={(updated) => setTemplates((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewTemplateForm onCreated={(created) => setTemplates((current) => [...current, created])} />
    </div>
  );
}
