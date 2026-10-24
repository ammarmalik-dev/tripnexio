"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ChevronDown, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/Toaster";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, deleteJson, getJson, patchJson, postJson } from "@/lib/api/client";
import { SITE_PAGES, SITE_PAGE_DEFS, type SitePage, type SiteSectionField } from "@/lib/site-content/pages";
import { sitePageImageUrl } from "@/lib/site-content/pages";
import { cn } from "@/lib/cn";

interface PageData {
  fields: Record<string, string>;
  heroImageUrl: string | null;
}

/**
 * Client doc 2026-10-15 (J3) — Admin edits the photo and main wording of the Home and service pages. Client
 * confirmation 2026-10-25 — and every other section (headings, text, cards / lists, pictures). Each box shows the
 * original copy as its placeholder; leaving a box blank keeps that original copy on the website.
 */
export function SitePagesManager() {
  const [page, setPage] = useState<SitePage>("home");
  const [data, setData] = useState<PageData | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const def = SITE_PAGE_DEFS[page];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setData(null);
      setError("");
      try {
        const result = await getJson<PageData>(`/api/admin/site-pages/${page}`);
        if (cancelled) return;
        setData(result);
        setDraft(result.fields);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof ApiError ? loadError.message : "Couldn't load this page.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const save = async () => {
    setSaving(true);
    try {
      const result = await patchJson<{ fields: Record<string, string> }>(`/api/admin/site-pages/${page}`, { fields: draft });
      setDraft(result.fields);
      setData((current) => (current ? { ...current, fields: result.fields } : current));
      toast.success(`${def.label} page saved. It's live on the website now.`);
    } catch (saveError) {
      toast.error(saveError instanceof ApiError ? saveError.message : "Couldn't save the page.");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Use a JPEG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return toast.error("That image is larger than 5MB.");
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
        reader.onerror = () => reject(new Error("Couldn't read that file."));
        reader.readAsDataURL(file);
      });
      const result = await postJson<{ heroImageUrl: string }>(`/api/admin/site-pages/${page}/image`, { data: base64 });
      setData((current) => (current ? { ...current, heroImageUrl: result.heroImageUrl } : current));
      toast.success("Photo updated.");
    } catch (uploadError) {
      toast.error(uploadError instanceof ApiError ? uploadError.message : "Couldn't upload the photo.");
    } finally {
      setUploading(false);
    }
  };

  const readBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.readAsDataURL(file);
    });

  /** A section picture (client confirmation 2026-10-25): stored by the upload route, so it never needs "Save page". */
  const uploadSectionImage = async (field: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Use a JPEG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return toast.error("That image is larger than 5MB.");
    setUploading(true);
    try {
      const result = await postJson<{ field: string; imageUrl: string }>(`/api/admin/site-pages/${page}/image`, { data: await readBase64(file), field });
      const fileId = decodeURIComponent(result.imageUrl.split("/").pop() ?? "");
      setData((current) => (current ? { ...current, fields: { ...current.fields, [field]: fileId } } : current));
      setDraft((current) => ({ ...current, [field]: fileId }));
      toast.success("Picture updated.");
    } catch (uploadError) {
      toast.error(uploadError instanceof ApiError ? uploadError.message : "Couldn't upload the picture.");
    } finally {
      setUploading(false);
    }
  };

  const removeSectionImage = async (field: string) => {
    setUploading(true);
    try {
      await deleteJson(`/api/admin/site-pages/${page}/image?field=${encodeURIComponent(field)}`);
      const drop = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).filter(([key]) => key !== field));
      setData((current) => (current ? { ...current, fields: drop(current.fields) } : current));
      setDraft((current) => drop(current));
      toast.success("Built-in picture restored.");
    } catch (removeError) {
      toast.error(removeError instanceof ApiError ? removeError.message : "Couldn't remove the picture.");
    } finally {
      setUploading(false);
    }
  };

  const textControl = (key: string, label: string, fallback: string, kind: "text" | "multiline" | "list", hint?: string) => {
    const id = `site-page-${key.replace(/[^a-zA-Z0-9]+/g, "-")}`;
    const value = draft[key] ?? "";
    const common = {
      id,
      value,
      placeholder: fallback || "(none)",
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [key]: event.target.value })),
      className: cn(fieldControlClass, fieldBorderClass(false), "text-sm"),
    };
    const rows = kind === "list" ? Math.min(10, Math.max(3, fallback.split("\n").length + 1)) : key === "steps" ? 5 : 3;
    return (
      <FormField key={key} label={label} htmlFor={id} hint={hint ?? (kind === "list" ? 'One item per line; separate the parts with "|". Blank = the original items.' : undefined)}>
        {kind === "text" ? <input type="text" {...common} /> : <textarea rows={rows} {...common} className={cn(common.className, "h-auto py-2")} />}
      </FormField>
    );
  };

  const pictureControl = (field: SiteSectionField) => {
    const fileId = data?.fields[field.key];
    const src = sitePageImageUrl(fileId) ?? field.fallback;
    return (
      <div key={field.key} className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-primary">{field.label}</span>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- an Admin preview of either an uploaded or a built-in picture
          <img src={src} alt={field.label} className="aspect-[16/9] w-full max-w-sm rounded-lg border border-hairline object-cover" />
        ) : (
          <p className="text-xs text-ink-tertiary">No picture.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-ink-on-dark-primary hover:opacity-90">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload picture"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void uploadSectionImage(field.key, event)} />
          </label>
          {fileId ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => void removeSectionImage(field.key)} disabled={uploading}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Use built-in picture
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-ink-tertiary">{field.hint ?? "JPEG, PNG or WebP, up to 5MB. Saved straight away."}</p>
      </div>
    );
  };

  const removeImage = async () => {
    setUploading(true);
    try {
      await deleteJson(`/api/admin/site-pages/${page}/image`);
      setData((current) => (current ? { ...current, heroImageUrl: null } : current));
      toast.success("Built-in photo restored.");
    } catch (removeError) {
      toast.error(removeError instanceof ApiError ? removeError.message : "Couldn't remove the photo.");
    } finally {
      setUploading(false);
    }
  };

  const dirty = data !== null && JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim()))) !== JSON.stringify(data.fields);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Website pages" className="flex flex-wrap gap-1.5">
        {SITE_PAGES.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={page === key}
            onClick={() => setPage(key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              page === key ? "bg-accent text-ink-on-dark-primary" : "border border-hairline bg-surface-1 text-ink-secondary hover:text-ink-primary"
            )}
          >
            {SITE_PAGE_DEFS[key].label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Couldn't load this page" description={error} />
      ) : !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
            <h2 className="text-sm font-semibold text-ink-heading">Photo</h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- an Admin preview of either an uploaded or a built-in photo */}
            <img src={data.heroImageUrl ?? def.defaultImage} alt={`${def.label} page photo`} className="aspect-[16/10] w-full rounded-lg object-cover" />
            <p className="text-xs text-ink-tertiary">{data.heroImageUrl ? "Your uploaded photo." : "The built-in photo."} JPEG, PNG or WebP, up to 5MB, wide (landscape) works best.</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-ink-on-dark-primary hover:opacity-90">
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                {uploading ? "Uploading…" : "Upload photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void upload(event)} />
              </label>
              {data.heroImageUrl ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void removeImage()} disabled={uploading}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Use built-in photo
                </Button>
              ) : null}
            </div>
            <a href={def.path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-ink-accent hover:underline">
              Open the page <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-heading">Wording</h2>
              <p className="text-xs text-ink-tertiary">Each box shows the original text. Leave a box blank to keep it.</p>
            </div>
            {def.fields.map((field) => textControl(field.key, field.label, field.fallback, field.multiline ? "multiline" : "text", field.hint))}
          </section>

          {(def.sections ?? []).length > 0 ? (
            <section className="flex flex-col gap-3 lg:col-span-2">
              <div>
                <h2 className="text-sm font-semibold text-ink-heading">Page sections</h2>
                <p className="text-xs text-ink-tertiary">Every section of the page, top to bottom. Open one to edit its wording and pictures.</p>
              </div>
              {(def.sections ?? []).map((section) => (
                <details key={section.id} className="group rounded-xl border border-hairline bg-surface-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink-heading marker:content-none">
                    {section.label}
                    <ChevronDown className="h-4 w-4 text-ink-tertiary transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="flex flex-col gap-4 border-t border-hairline p-4">
                    {section.fields.map((field) => (field.kind === "image" ? pictureControl(field) : textControl(field.key, field.label, field.fallback, field.kind, field.hint)))}
                  </div>
                </details>
              ))}
            </section>
          ) : null}

          <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-xl border border-hairline bg-surface-1/95 p-3 backdrop-blur lg:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(data.fields)} disabled={!dirty || saving}>
              Undo changes
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty}>
              Save page
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
