"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
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
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import type { NotificationChannel } from "../../generated/prisma/enums";

interface TemplateData {
  id: string;
  event: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  active: boolean;
  metaTemplateName: string | null;
  metaTemplateLanguage: string | null;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "active" | "disabled";

interface FormState {
  event: string;
  channel: NotificationChannel | "";
  subject: string;
  body: string;
  metaTemplateName: string;
  metaTemplateLanguage: string;
}

const EMPTY_FORM: FormState = { event: "", channel: "", subject: "", body: "", metaTemplateName: "", metaTemplateLanguage: "" };

function toFormState(template: TemplateData): FormState {
  return {
    event: template.event,
    channel: template.channel,
    subject: template.subject ?? "",
    body: template.body,
    metaTemplateName: template.metaTemplateName ?? "",
    metaTemplateLanguage: template.metaTemplateLanguage ?? "",
  };
}

function buildPayload(form: FormState) {
  return {
    event: form.event.trim(),
    channel: form.channel || undefined,
    subject: form.channel === "EMAIL" && form.subject.trim() !== "" ? form.subject.trim() : undefined,
    body: form.body,
    metaTemplateName: form.channel === "WHATSAPP" ? form.metaTemplateName.trim() : "",
    metaTemplateLanguage: form.channel === "WHATSAPP" ? form.metaTemplateLanguage.trim() : "",
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
      {form.channel === "WHATSAPP" ? (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-dashed border-hairline p-4 sm:grid-cols-2">
          <TextField
            label="Meta Template Name"
            name="metaTemplateName"
            placeholder="e.g. lead_received_v1"
            hint="Fill in only once Meta has approved this exact copy — see docs/deployment/WHATSAPP_SETUP.md."
            value={form.metaTemplateName}
            onChange={(event) => onChange({ ...form, metaTemplateName: event.target.value })}
            error={errors.metaTemplateName?.[0]}
            disabled={disabled}
          />
          <TextField
            label="Meta Template Language"
            name="metaTemplateLanguage"
            placeholder="e.g. en or en_US"
            value={form.metaTemplateLanguage}
            onChange={(event) => onChange({ ...form, metaTemplateLanguage: event.target.value })}
            error={errors.metaTemplateLanguage?.[0]}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

function TemplateCard({ template, onSaved }: { template: TemplateData; onSaved: (template: TemplateData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(template));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(template));
  const isWhatsApp = template.channel === "WHATSAPP";
  const whatsappNotApproved = isWhatsApp && !template.metaTemplateName?.trim();

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      await postJson(`/api/admin/notification-templates/${template.id}/test-send`, { to: testTarget.trim() });
      toast.success(
        isWhatsApp
          ? `Test WhatsApp message sent to ${testTarget.trim()}. Check the server console if the Cloud API isn't configured yet.`
          : `Test email sent to ${testTarget.trim()}. Check the server console if Resend isn't configured yet.`
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send a test. Please try again.");
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-all font-mono text-sm font-semibold text-ink-heading">{template.event}</h3>
            <span className="rounded-md bg-ink-primary/[0.05] px-1.5 py-0.5 text-xs text-ink-secondary">
              {NOTIFICATION_CHANNEL_OPTIONS.find((option) => option.value === template.channel)?.label ?? template.channel}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                template.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}
            >
              {template.active ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">
            {isWhatsApp
              ? template.metaTemplateName?.trim()
                ? `Meta template: ${template.metaTemplateName} (${template.metaTemplateLanguage || "no language"})`
                : "Meta template not set — WhatsApp sends outside the 24h window are skipped"
              : template.subject?.trim()
                ? `Subject: ${template.subject}`
                : "No subject set"}
          </p>
        </div>
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
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <input
          type={isWhatsApp ? "text" : "email"}
          placeholder={isWhatsApp ? "919876543210" : "you@example.com"}
          value={testTarget}
          onChange={(event) => setTestTarget(event.target.value)}
          disabled={dirty || sendingTest}
          className={cn(fieldControlClass, fieldBorderClass(false), "max-w-xs")}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void handleSendTest()}
          isLoading={sendingTest}
          disabled={dirty || !testTarget.trim() || !template.active || whatsappNotApproved}
        >
          Send Test
        </Button>
        {dirty ? (
          <span className="text-xs text-ink-tertiary">Save your changes first — this tests the saved template.</span>
        ) : whatsappNotApproved ? (
          <span className="text-xs text-ink-tertiary">Set the Meta Template Name above before testing — Meta rejects unapproved templates.</span>
        ) : null}
      </div>
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
    <div className="flex flex-col gap-4">
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
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (channelFilter && template.channel !== channelFilter) return false;
      if (statusFilter === "active" && !template.active) return false;
      if (statusFilter === "disabled" && template.active) return false;
      if (!term) return true;
      return [template.event, template.subject ?? "", template.body, template.metaTemplateName ?? ""].some((value) =>
        value.toLowerCase().includes(term)
      );
    });
  }, [templates, search, channelFilter, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

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

  const clearFilters = () => {
    setSearch("");
    setChannelFilter("");
    setStatusFilter("all");
    resetPage();
  };
  const createOpen = showCreate || templates.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-template-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new notification template
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-template-panel" className="border-t border-hairline p-5">
            <NewTemplateForm
              onCreated={(created) => {
                setTemplates((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {templates.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search notification templates"
              placeholder="Search event, subject, body or Meta name"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by channel"
            value={channelFilter}
            onChange={(event) => {
              setChannelFilter(event.target.value as NotificationChannel | "");
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-40")}
          >
            <option value="">All channels</option>
            {NOTIFICATION_CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-36")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} template{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {templates.length === 0 ? (
        <EmptyState title="No notification templates yet" description="Add the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No templates match "${trimmedSearch}"` : "No templates match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSaved={(updated) => setTemplates((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
            />
          ))}
        </div>
      )}

      <ListPagination noun="template" {...paginationProps} />
    </div>
  );
}
