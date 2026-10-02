"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, FileText, RotateCcw, Save, Undo2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { LegalMarkup } from "@/components/legal/LegalMarkup";
import { ApiError, deleteJson, getJson, putJson } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { LEGAL_PAGE_META, type LegalPageContent, type LegalPageSlug } from "@/lib/legal/pages";
import { cn } from "@/lib/cn";

interface LegalPageRow {
  slug: LegalPageSlug;
  customized: boolean;
  updatedAt: string | null;
  content: LegalPageContent;
  original: LegalPageContent;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  title: string;
  eyebrow: string;
  intro: string;
  effectiveDate: string;
  showReviewNotice: boolean;
  body: string;
}

function toForm(content: LegalPageContent): FormState {
  return {
    title: content.title,
    eyebrow: content.eyebrow ?? "",
    intro: content.intro,
    effectiveDate: content.effectiveDate ?? "",
    showReviewNotice: content.showReviewNotice,
    body: content.body,
  };
}

const FORMAT_HELP = [
  ["## Heading", "starts a new section"],
  ["(blank line)", "starts a new paragraph"],
  ["- item", "bullet point"],
  ["**text**", "bold"],
  ["[text](https://…)", "link"],
] as const;

function PageEditor({ row, onSaved, onReset }: { row: LegalPageRow; onSaved: (row: LegalPageRow) => void; onReset: (row: LegalPageRow) => void }) {
  const initial = useMemo(() => toForm(row.content), [row.content]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const { confirm, dialog } = useConfirmAction();
  const meta = LEGAL_PAGE_META[row.slug];
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const saved = await putJson<LegalPageContent & { updatedAt: string }>(`/api/admin/legal-pages/${row.slug}`, form);
      toast.success(`${meta.label} saved. The live page is updated.`);
      onSaved({
        ...row,
        customized: true,
        updatedAt: saved.updatedAt,
        content: {
          title: saved.title,
          eyebrow: saved.eyebrow,
          intro: saved.intro,
          effectiveDate: saved.effectiveDate,
          showReviewNotice: saved.showReviewNotice,
          body: saved.body,
        },
      });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const reason = await confirm({
      title: `Reset ${meta.label} to the original text?`,
      description: "Your edits to this page are removed and it shows the original approved copy again.",
      confirmLabel: "Reset page",
    });
    if (!reason) return;
    setSaving(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/legal-pages/${row.slug}`, reason));
      toast.success(`${meta.label} reset to the original text.`);
      onReset({ ...row, customized: false, updatedAt: null, content: row.original });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't reset. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-heading">{meta.label}</h2>
          <p className="text-xs text-ink-tertiary">
            tripnexio.com{meta.path} ·{" "}
            {row.customized ? `Edited${row.updatedAt ? ` ${new Date(row.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "Original text"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={meta.path}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-sm font-medium text-ink-primary hover:border-glass-border"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View live
          </Link>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((current) => !current)}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            {showPreview ? "Hide preview" : "Show preview"}
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-5", showPreview && "2xl:grid-cols-2")}>
        <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Small label above the title" name="eyebrow" value={form.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} error={errors.eyebrow?.[0]} disabled={saving} />
            <TextField label="Effective date" name="effectiveDate" placeholder="e.g. 23 September 2026 (blank = hidden)" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} error={errors.effectiveDate?.[0]} disabled={saving} />
          </div>
          <TextField label="Title" name="title" value={form.title} onChange={(e) => set("title", e.target.value)} error={errors.title?.[0]} disabled={saving} required />
          <Textarea label="Introduction" name="intro" rows={3} value={form.intro} onChange={(e) => set("intro", e.target.value)} error={errors.intro?.[0]} disabled={saving} required />
          <Textarea
            label="Page content"
            name="body"
            rows={22}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            error={errors.body?.[0]}
            disabled={saving}
            required
            className="font-mono text-[13px] leading-relaxed"
          />
          <div className="flex flex-col gap-2 rounded-lg bg-ink-primary/[0.03] p-3 text-xs text-ink-tertiary">
            <p className="font-medium text-ink-secondary">Formatting</p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {FORMAT_HELP.map(([syntax, meaning]) => (
                <li key={syntax}>
                  <code className="rounded bg-surface-2 px-1 py-0.5 text-ink-primary">{syntax}</code> {meaning}
                </li>
              ))}
            </ul>
            <p>Extra spaces and empty lines are removed automatically.</p>
            {meta.tokens.length > 0 ? (
              <div className="flex flex-col gap-1 border-t border-hairline pt-2">
                <p className="font-medium text-ink-secondary">Automatic parts (put on a line of their own)</p>
                {meta.tokens.map(({ token, meaning }) => (
                  <p key={token}>
                    <code className="rounded bg-surface-2 px-1 py-0.5 text-ink-primary">{token}</code> {meaning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          {row.slug !== "about" ? (
            <div className="flex items-start justify-between gap-4 rounded-lg border border-hairline px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-primary">Show &ldquo;pending legal review&rdquo; notice</p>
                <p className="text-xs text-ink-tertiary">Switch off once your legal counsel has approved this page.</p>
              </div>
              <Switch checked={form.showReviewNotice} onChange={(on) => set("showReviewNotice", on)} disabled={saving} label="Show pending legal review notice" />
            </div>
          ) : null}
        </div>

        {showPreview ? (
          <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-base p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-tertiary">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Preview
            </p>
            {form.eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-ink-accent">{form.eyebrow}</p> : null}
            <h3 className="text-2xl font-semibold tracking-tight text-ink-heading">{form.title || "Untitled"}</h3>
            <p className="text-sm text-ink-secondary">{form.intro}</p>
            {form.effectiveDate ? <p className="text-sm text-ink-tertiary">Effective Date: {form.effectiveDate}</p> : null}
            <LegalMarkup
              body={form.body}
              tokens={Object.fromEntries(
                meta.tokens.map(({ token, meaning }) => [
                  token.replace(/[{}]/g, ""),
                  <p key={token} className="rounded-md bg-accent/[0.06] px-3 py-2 text-xs text-accent-on-light">
                    [{meaning}]
                  </p>,
                ])
              )}
            />
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-base/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className={cn("text-sm", dirty ? "font-medium text-warning" : "text-ink-tertiary")} aria-live="polite">
          {dirty ? "You have unsaved changes" : "All changes saved"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {row.customized ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void reset()} disabled={saving}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset to original
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setForm(initial)} disabled={!dirty || saving}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Discard
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Save &amp; publish
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LegalPagesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [rows, setRows] = useState<LegalPageRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selected, setSelected] = useState<LegalPageSlug>("about");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<LegalPageRow[]>("/api/admin/legal-pages");
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the legal pages. Please try again.");
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the legal pages"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const row = rows.find((candidate) => candidate.slug === selected) ?? rows[0];
  const replace = (next: LegalPageRow) => setRows((current) => current.map((candidate) => (candidate.slug === next.slug ? next : candidate)));

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Legal pages" className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-3 lg:sticky lg:top-4">
        {rows.map((candidate) => {
          const active = candidate.slug === row.slug;
          return (
            <button
              key={candidate.slug}
              type="button"
              onClick={() => setSelected(candidate.slug)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                active ? "border-accent/30 bg-accent/[0.07] font-medium text-accent-on-light" : "border-transparent text-ink-primary hover:bg-ink-primary/[0.03]"
              )}
            >
              {LEGAL_PAGE_META[candidate.slug].label}
              {candidate.customized ? <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-on-light">Edited</span> : null}
            </button>
          );
        })}
      </nav>
      <PageEditor key={`${row.slug}-${row.updatedAt ?? "original"}`} row={row} onSaved={replace} onReset={replace} />
    </div>
  );
}
