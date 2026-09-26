"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { KNOWLEDGE_ARTICLE_CATEGORY_LABELS, KNOWLEDGE_ARTICLE_CATEGORY_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { KnowledgeArticleCategory } from "../../generated/prisma/enums";

interface KnowledgeArticleData {
  id: string;
  title: string;
  category: KnowledgeArticleCategory;
  content: string;
  keywords: string[];
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  title: string;
  category: KnowledgeArticleCategory | "";
  content: string;
  keywords: string;
  displayOrder: string;
}

const EMPTY_FORM: FormState = { title: "", category: "", content: "", keywords: "", displayOrder: "0" };

function toFormState(article: KnowledgeArticleData): FormState {
  return {
    title: article.title,
    category: article.category,
    content: article.content,
    keywords: article.keywords.join(", "),
    displayOrder: String(article.displayOrder),
  };
}

function buildPayload(form: FormState) {
  return {
    title: form.title.trim(),
    category: form.category === "" ? undefined : form.category,
    content: form.content.trim(),
    keywords: form.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    displayOrder: form.displayOrder === "" ? 0 : Number(form.displayOrder),
  };
}

function ArticleFields({
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
      <TextField
        label="Title"
        name="title"
        value={form.title}
        onChange={(event) => onChange({ ...form, title: event.target.value })}
        error={errors.title?.[0]}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Category" htmlFor="category" error={errors.category?.[0]}>
          <select
            id="category"
            value={form.category}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, category: event.target.value as KnowledgeArticleCategory })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.category))}
          >
            <option value="">Select a category</option>
            {KNOWLEDGE_ARTICLE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
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
      <Textarea
        label="Content"
        name="content"
        rows={8}
        value={form.content}
        onChange={(event) => onChange({ ...form, content: event.target.value })}
        error={errors.content?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Keywords"
        name="keywords"
        placeholder="Comma-separated — helps search find this article"
        value={form.keywords}
        onChange={(event) => onChange({ ...form, keywords: event.target.value })}
        error={errors.keywords?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

function ArticleCard({ article, canEdit, onSaved }: { article: KnowledgeArticleData; canEdit: boolean; onSaved: (article: KnowledgeArticleData) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(toFormState(article));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(article));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<KnowledgeArticleData>(`/api/knowledge-articles/${article.id}`, buildPayload(form));
      toast.success("Article updated.");
      onSaved(updated);
      setEditing(false);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this article. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<KnowledgeArticleData>(`/api/knowledge-articles/${article.id}`, { active: !article.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this article. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-on-light">{KNOWLEDGE_ARTICLE_CATEGORY_LABELS[article.category]}</span>
            {!article.active ? <span className="rounded-full bg-error/10 px-2.5 py-1 text-xs font-medium text-error">Disabled</span> : null}
          </div>
          <h3 className="text-sm font-semibold text-ink-heading">{article.title}</h3>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
              {article.active ? "Disable" : "Enable"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((current) => !current)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <>
          <ArticleFields form={form} onChange={setForm} errors={errors} disabled={saving} />
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
              Save Changes
            </Button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{article.content}</p>
      )}

      {article.keywords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {article.keywords.map((keyword) => (
            <span key={keyword} className="rounded-full bg-ink-primary/[0.05] px-2 py-0.5 text-[11px] text-ink-tertiary">
              {keyword}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewArticleForm({ onCreated }: { onCreated: (article: KnowledgeArticleData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<KnowledgeArticleData>("/api/knowledge-articles", buildPayload(form));
      toast.success("Article created.");
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this article. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.title.trim().length >= 4 && form.category !== "" && form.content.trim().length >= 4;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Article</h2>
      <ArticleFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Article
        </Button>
      </div>
    </div>
  );
}

export function KnowledgeCentreManager({ canEdit }: { canEdit: boolean }) {
  const [state, setState] = useState<FetchState>("loading");
  const [articles, setArticles] = useState<KnowledgeArticleData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<KnowledgeArticleCategory | "ALL">("ALL");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<KnowledgeArticleData[]>("/api/knowledge-articles");
        if (cancelled) return;
        setArticles(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the Knowledge Centre. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const visibleArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return articles
      .filter((article) => canEdit || article.active)
      .filter((article) => categoryFilter === "ALL" || article.category === categoryFilter)
      .filter((article) => {
        if (!query) return true;
        return (
          article.title.toLowerCase().includes(query) ||
          article.content.toLowerCase().includes(query) ||
          article.keywords.some((keyword) => keyword.toLowerCase().includes(query))
        );
      });
  }, [articles, canEdit, categoryFilter, search]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the Knowledge Centre"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search SOPs, staff FAQ, training material…"
            className={cn(fieldControlClass, "pl-9")}
            aria-label="Search the Knowledge Centre"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as KnowledgeArticleCategory | "ALL")}
          className={cn(fieldControlClass, "sm:w-56")}
          aria-label="Filter by category"
        >
          <option value="ALL">All categories</option>
          {KNOWLEDGE_ARTICLE_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {visibleArticles.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          title={articles.length === 0 ? "Nothing here yet" : "No matches"}
          description={articles.length === 0 ? "SOPs, staff FAQ, and training material will show up here once added." : "Try a different search or category."}
        />
      ) : (
        visibleArticles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            canEdit={canEdit}
            onSaved={(updated) => setArticles((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}

      {canEdit ? <NewArticleForm onCreated={(created) => setArticles((current) => [...current, created])} /> : null}
    </div>
  );
}
