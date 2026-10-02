"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import type { ServiceType } from "../../generated/prisma/enums";

interface CountryOption {
  id: string;
  name: string;
}

let countriesRequest: Promise<CountryOption[]> | null = null;

/** Active countries for the New Visa "Country page" picker; fetched once per page load. */
function useCountryOptions(): CountryOption[] {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      countriesRequest ??= getJson<CountryOption[]>("/api/countries").catch(() => {
        countriesRequest = null;
        return [];
      });
      const list = await countriesRequest;
      if (!cancelled) setCountries(list);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  return countries;
}

interface FaqData {
  id: string;
  question: string;
  answer: string;
  serviceType: ServiceType | null;
  countryId: string | null;
  country?: { name: string } | null;
  category: string | null;
  keywords: string[];
  displayOrder: number;
  active: boolean;
  published: boolean;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "published" | "draft" | "active" | "disabled";
/** "" = every service, "GENERAL" = FAQs not tied to one service. */
type ServiceFilter = ServiceType | "" | "GENERAL";

function serviceLabel(serviceType: ServiceType | null): string {
  if (!serviceType) return "General";
  return SERVICE_TYPE_OPTIONS.find((option) => option.value === serviceType)?.label ?? serviceType;
}

interface FormState {
  question: string;
  answer: string;
  serviceType: ServiceType | "";
  countryId: string;
  category: string;
  keywords: string;
  displayOrder: string;
}

const EMPTY_FORM: FormState = { question: "", answer: "", serviceType: "", countryId: "", category: "", keywords: "", displayOrder: "0" };

function toFormState(faq: FaqData): FormState {
  return {
    question: faq.question,
    answer: faq.answer,
    serviceType: faq.serviceType ?? "",
    countryId: faq.countryId ?? "",
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
    // Only New Visa FAQs belong to a country page.
    countryId: form.serviceType === "NEW_VISA" && form.countryId !== "" ? form.countryId : null,
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
  const countries = useCountryOptions();
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
        {form.serviceType === "NEW_VISA" ? (
          <FormField
            label="Country page"
            htmlFor="faqCountry"
            hint="Pick a country to show this FAQ only on that country's New Visa page."
            error={errors.countryId?.[0]}
          >
            <select
              id="faqCountry"
              value={form.countryId}
              disabled={disabled}
              onChange={(event) => onChange({ ...form, countryId: event.target.value })}
              className={cn(fieldControlClass, fieldBorderClass(!!errors.countryId))}
            >
              <option value="">All New Visa pages</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
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
  const { confirm, dialog } = useConfirmAction();
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
    const reason = await confirm({
      title: `Delete FAQ "${faq.question}"?`,
      description: "This permanently deletes the FAQ. To hide it temporarily, unpublish or disable it instead.",
      confirmLabel: "Delete FAQ",
    });
    if (!reason) return;
    setDeleting(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/faqs/${faq.id}`, reason));
      toast.success("FAQ deleted.");
      onDeleted(faq.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete this FAQ. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                faq.published ? "bg-accent/10 text-accent-on-light" : "bg-ink-primary/[0.06] text-ink-tertiary"
              )}
            >
              {faq.published ? "Published" : "Draft"}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                faq.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}
            >
              {faq.active ? "Active" : "Disabled"}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-ink-heading">{faq.question}</h3>
          <p className="mt-1 text-xs text-ink-tertiary">
            {[
              faq.country ? `${serviceLabel(faq.serviceType)} · ${faq.country.name}` : serviceLabel(faq.serviceType),
              faq.category,
              `Order ${faq.displayOrder}`,
              faq.keywords.length > 0 ? `${faq.keywords.length} keyword${faq.keywords.length === 1 ? "" : "s"}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
            {faq.active ? "Disable" : "Enable"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleTogglePublished()} isLoading={togglingPublished}>
            {faq.published ? "Unpublish" : "Publish"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
          {dialog}
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
    <div className="flex flex-col gap-4">
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
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return faqs.filter((faq) => {
      if (serviceFilter === "GENERAL" && faq.serviceType !== null) return false;
      if (serviceFilter && serviceFilter !== "GENERAL" && faq.serviceType !== serviceFilter) return false;
      if (statusFilter === "published" && !faq.published) return false;
      if (statusFilter === "draft" && faq.published) return false;
      if (statusFilter === "active" && !faq.active) return false;
      if (statusFilter === "disabled" && faq.active) return false;
      if (!term) return true;
      return [faq.question, faq.answer, faq.category ?? "", ...faq.keywords].some((value) => value.toLowerCase().includes(term));
    });
  }, [faqs, search, serviceFilter, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

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

  const clearFilters = () => {
    setSearch("");
    setServiceFilter("");
    setStatusFilter("all");
    resetPage();
  };
  const createOpen = showCreate || faqs.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-faq-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new FAQ
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-faq-panel" className="border-t border-hairline p-5">
            <NewFaqForm
              onCreated={(created) => {
                setFaqs((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {faqs.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search FAQs"
              placeholder="Search question, answer, category or keyword"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by service"
            value={serviceFilter}
            onChange={(event) => {
              setServiceFilter(event.target.value as ServiceFilter);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-48")}
          >
            <option value="">All services</option>
            <option value="GENERAL">General</option>
            {SERVICE_TYPE_OPTIONS.map((option) => (
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
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-40")}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft (unpublished)</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} FAQ{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {faqs.length === 0 ? (
        <EmptyState title="No FAQs yet" description="Add the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No FAQs match "${trimmedSearch}"` : "No FAQs match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((faq) => (
            <FaqCard
              key={faq.id}
              faq={faq}
              onSaved={(updated) => setFaqs((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
              onDeleted={(id) => setFaqs((current) => current.filter((entry) => entry.id !== id))}
            />
          ))}
        </div>
      )}

      <ListPagination noun="FAQ" {...paginationProps} />
    </div>
  );
}
