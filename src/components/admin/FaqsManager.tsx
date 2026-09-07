"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface FaqData {
  id: string;
  question: string;
  answer: string;
  serviceType: ServiceType | null;
  category: string | null;
  keywords: string[];
  displayOrder: number;
  active: boolean;
  published: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  question: string;
  answer: string;
  serviceType: ServiceType | "";
  category: string;
  keywords: string;
  displayOrder: string;
}

const EMPTY_FORM: FormState = { question: "", answer: "", serviceType: "", category: "", keywords: "", displayOrder: "0" };

function toFormState(faq: FaqData): FormState {
  return {
    question: faq.question,
    answer: faq.answer,
    serviceType: faq.serviceType ?? "",
    category: faq.category ?? "",
    keywords: faq.keywords.join(", "),
    displayOrder: String(faq.displayOrder),
  };
}

function buildPayload(form: FormState) {
  return {
    question: form.question.trim(),
    answer: form.answer.trim(),
    serviceType: form.serviceType === "" ? null : form.serviceType,
    category: form.category.trim() === "" ? undefined : form.category.trim(),
    keywords: form.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    displayOrder: form.displayOrder === "" ? 0 : Number(form.displayOrder),
  };
}

function FaqFields({
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
      <Textarea
        label="Question"
        name="question"
        rows={2}
        value={form.question}
        onChange={(event) => onChange({ ...form, question: event.target.value })}
        error={errors.question?.[0]}
        disabled={disabled}
      />
      <Textarea
        label="Answer"
        name="answer"
        rows={4}
        value={form.answer}
        onChange={(event) => onChange({ ...form, answer: event.target.value })}
        error={errors.answer?.[0]}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Service" htmlFor="serviceType" hint="Leave as General if this FAQ isn't tied to one service." error={errors.serviceType?.[0]}>
          <select
            id="serviceType"
            value={form.serviceType}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceType })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceType))}
          >
            <option value="">General (all services)</option>
            {SERVICE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <TextField
          label="Category"
          name="category"
          placeholder="Optional"
          value={form.category}
          onChange={(event) => onChange({ ...form, category: event.target.value })}
          error={errors.category?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Keywords"
          name="keywords"
          placeholder="Comma-separated"
          value={form.keywords}
          onChange={(event) => onChange({ ...form, keywords: event.target.value })}
          error={errors.keywords?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Display Order"
          name="displayOrder"
          type="number"
          value={form.displayOrder}
          onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
          error={errors.displayOrder?.[0]}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function FaqCard({ faq, onSaved, onDeleted }: { faq: FaqData; onSaved: (faq: FaqData) => void; onDeleted: (id: string) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(faq));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [togglingPublished, setTogglingPublished] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(faq));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<FaqData>(`/api/admin/faqs/${faq.id}`, buildPayload(form));
      toast.success("FAQ updated.");
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this FAQ. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<FaqData>(`/api/admin/faqs/${faq.id}`, { active: !faq.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this FAQ. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleTogglePublished = async () => {
    setTogglingPublished(true);
    try {
      const updated = await patchJson<FaqData>(`/api/admin/faqs/${faq.id}`, { published: !faq.published });
      toast.success(updated.published ? "Published." : "Unpublished.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this FAQ. Please try again.");
    } finally {
      setTogglingPublished(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJson(`/api/admin/faqs/${faq.id}`);
      toast.success("FAQ deleted.");
      onDeleted(faq.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete this FAQ. Please try again.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", faq.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {faq.active ? "Active" : "Disabled"}
          </span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", faq.published ? "bg-accent/10 text-accent-on-light" : "bg-ink-primary/[0.06] text-ink-tertiary")}>
            {faq.published ? "Published" : "Draft"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
            {faq.active ? "Disable" : "Enable"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleTogglePublished()} isLoading={togglingPublished}>
            {faq.published ? "Unpublish" : "Publish"}
          </Button>
          {confirmingDelete ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
                Confirm Delete
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>
      <FaqFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewFaqForm({ onCreated }: { onCreated: (faq: FaqData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<FaqData>("/api/admin/faqs", buildPayload(form));
      toast.success("FAQ created.");
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this FAQ. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.question.trim().length >= 4 && form.answer.trim().length >= 4;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New FAQ</h2>
      <FaqFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create FAQ
        </Button>
      </div>
    </div>
  );
}

export function FaqsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [faqs, setFaqs] = useState<FaqData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<FaqData[]>("/api/admin/faqs");
        if (cancelled) return;
        setFaqs(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load FAQs. Please try again.");
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
        title="Couldn't load FAQs"
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
      {faqs.length === 0 ? (
        <EmptyState title="No FAQs yet" description="Add the first one using the form below." />
      ) : (
        faqs.map((faq) => (
          <FaqCard
            key={faq.id}
            faq={faq}
            onSaved={(updated) => setFaqs((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
            onDeleted={(id) => setFaqs((current) => current.filter((entry) => entry.id !== id))}
          />
        ))
      )}
      <NewFaqForm onCreated={(created) => setFaqs((current) => [...current, created])} />
    </div>
  );
}
