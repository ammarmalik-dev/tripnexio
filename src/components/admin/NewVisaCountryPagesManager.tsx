"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, ImagePlus, Info, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, deleteJson, getJson, patchJson, postJson } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { DocumentMasterPicker } from "./DocumentMasterPicker";

interface CountryOption {
  id: string;
  code: string;
  name: string;
  active: boolean;
  activeProducts: number;
}

interface CountryPage {
  id: string;
  countryId: string;
  slug: string;
  published: boolean;
  displayOrder: number;
  cardTagline: string | null;
  cardImageFileId: string | null;
  heroImageFileId: string | null;
  heroEyebrow: string | null;
  heroTitle: string;
  heroSubtitle: string;
  introHeading: string | null;
  introBody: string | null;
  applicantsHeading: string | null;
  applicantsBody: string | null;
  whatYouNeed: string[];
  documents: string[];
  documentsNote: string | null;
  childrenNote: string | null;
  validityText: string | null;
  stayText: string | null;
  beforeYouApply: string[];
  ctaHeading: string | null;
  ctaBody: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  country: { id: string; code: string; name: string; active: boolean };
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;
const NEW = "__new__";

/** Form state: every text field as a string, lists as one item per line. */
interface FormState {
  countryId: string;
  slug: string;
  published: boolean;
  displayOrder: string;
  cardTagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  introHeading: string;
  introBody: string;
  applicantsHeading: string;
  applicantsBody: string;
  whatYouNeed: string;
  documents: string;
  documentsNote: string;
  childrenNote: string;
  validityText: string;
  stayText: string;
  beforeYouApply: string;
  ctaHeading: string;
  ctaBody: string;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY_FORM: FormState = {
  countryId: "",
  slug: "",
  published: false,
  displayOrder: "0",
  cardTagline: "",
  heroEyebrow: "",
  heroTitle: "",
  heroSubtitle: "",
  introHeading: "",
  introBody: "",
  applicantsHeading: "",
  applicantsBody: "",
  whatYouNeed: "",
  documents: "",
  documentsNote: "",
  childrenNote: "",
  validityText: "",
  stayText: "",
  beforeYouApply: "",
  ctaHeading: "",
  ctaBody: "",
  seoTitle: "",
  seoDescription: "",
};

function toForm(page: CountryPage): FormState {
  const text = (value: string | null) => value ?? "";
  return {
    countryId: page.countryId,
    slug: page.slug,
    published: page.published,
    displayOrder: String(page.displayOrder),
    cardTagline: text(page.cardTagline),
    heroEyebrow: text(page.heroEyebrow),
    heroTitle: page.heroTitle,
    heroSubtitle: page.heroSubtitle,
    introHeading: text(page.introHeading),
    introBody: text(page.introBody),
    applicantsHeading: text(page.applicantsHeading),
    applicantsBody: text(page.applicantsBody),
    whatYouNeed: page.whatYouNeed.join("\n"),
    documents: page.documents.join("\n"),
    documentsNote: text(page.documentsNote),
    childrenNote: text(page.childrenNote),
    validityText: text(page.validityText),
    stayText: text(page.stayText),
    beforeYouApply: page.beforeYouApply.join("\n"),
    ctaHeading: text(page.ctaHeading),
    ctaBody: text(page.ctaBody),
    seoTitle: text(page.seoTitle),
    seoDescription: text(page.seoDescription),
  };
}

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function toPayload(form: FormState) {
  const optional = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    slug: form.slug.trim().toLowerCase(),
    published: form.published,
    displayOrder: form.displayOrder === "" ? 0 : Number(form.displayOrder),
    cardTagline: optional(form.cardTagline),
    heroEyebrow: optional(form.heroEyebrow),
    heroTitle: form.heroTitle.trim(),
    heroSubtitle: form.heroSubtitle.trim(),
    introHeading: optional(form.introHeading),
    introBody: optional(form.introBody),
    applicantsHeading: optional(form.applicantsHeading),
    applicantsBody: optional(form.applicantsBody),
    whatYouNeed: lines(form.whatYouNeed),
    documents: lines(form.documents),
    documentsNote: optional(form.documentsNote),
    childrenNote: optional(form.childrenNote),
    validityText: optional(form.validityText),
    stayText: optional(form.stayText),
    beforeYouApply: lines(form.beforeYouApply),
    ctaHeading: optional(form.ctaHeading),
    ctaBody: optional(form.ctaBody),
    seoTitle: optional(form.seoTitle),
    seoDescription: optional(form.seoDescription),
  };
}

/** "Saudi Arabia" -> "saudi-arabia" */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function imageUrl(fileId: string | null): string | null {
  return fileId ? `/api/new-visa-pages/image/${encodeURIComponent(fileId)}` : null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <header>
        <h3 className="text-sm font-semibold text-ink-heading">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-tertiary">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function ImageField({
  label,
  hint,
  pageId,
  kind,
  fileId,
  onChanged,
}: {
  label: string;
  hint: string;
  pageId: string | null;
  kind: "card" | "hero";
  fileId: string | null;
  onChanged: (fileId: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const url = imageUrl(fileId);

  const upload = async (file: File | undefined) => {
    if (!file || !pageId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That image is larger than 5MB. Please use a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const data = await readFileAsBase64(file);
      const result = await postJson<{ fileId: string }>(`/api/admin/new-visa-pages/${pageId}/image`, { kind, data });
      onChanged(result.fileId);
      toast.success(`${label} updated.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the image. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pageId) return;
    setBusy(true);
    try {
      await deleteJson(`/api/admin/new-visa-pages/${pageId}/image?kind=${kind}`);
      onChanged(null);
      toast.success(`${label} removed. The default photo will be used.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the image. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-primary">{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "relative flex aspect-[16/10] w-48 items-center justify-center overflow-hidden rounded-lg border border-dashed border-hairline bg-surface-2 text-xs text-ink-tertiary",
            url && "border-solid"
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of our own image route
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>Default photo</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {pageId ? (
            <>
              <label
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary transition-colors hover:border-glass-border focus-within:outline focus-within:outline-2 focus-within:outline-accent",
                  busy && "pointer-events-none opacity-50"
                )}
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {url ? "Replace image" : "Upload image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    void upload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {url ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </>
          ) : (
            <p className="max-w-xs text-xs text-ink-tertiary">Create the page first, then upload images.</p>
          )}
          <p className="max-w-xs text-xs text-ink-tertiary">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function PageEditor({
  page,
  countries,
  takenCountryIds,
  onSaved,
  onCreated,
  onDirtyChange,
}: {
  page: CountryPage | null;
  countries: CountryOption[];
  takenCountryIds: Set<string>;
  onSaved: (page: CountryPage) => void;
  onCreated: (page: CountryPage) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => (page ? toForm(page) : EMPTY_FORM), [page]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [cardImage, setCardImage] = useState(page?.cardImageFileId ?? null);
  const [heroImage, setHeroImage] = useState(page?.heroImageFileId ?? null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const country = countries.find((option) => option.id === form.countryId) ?? null;
  const availableCountries = countries.filter((option) => !takenCountryIds.has(option.id) || option.id === page?.countryId);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (page) {
        const updated = await patchJson<CountryPage>(`/api/admin/new-visa-pages/${page.id}`, toPayload(form));
        toast.success(`${page.country.name} page saved.`);
        onSaved({ ...page, ...updated, cardImageFileId: cardImage, heroImageFileId: heroImage, country: page.country });
      } else {
        const created = await postJson<CountryPage>("/api/admin/new-visa-pages", { countryId: form.countryId, ...toPayload(form) });
        const createdCountry = countries.find((option) => option.id === created.countryId);
        toast.success(`${createdCountry?.name ?? "Country"} page created. You can now upload its images.`);
        onCreated({
          ...created,
          country: {
            id: created.countryId,
            code: createdCountry?.code ?? "",
            name: createdCountry?.name ?? "",
            active: createdCountry?.active ?? true,
          },
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors ?? {});
        toast.error(error.message);
      } else {
        toast.error("Couldn't save the page. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const text = (key: keyof FormState, label: string, extra: { hint?: string; placeholder?: string; required?: boolean } = {}) => (
    <TextField
      label={label}
      name={`nv-${key}`}
      value={String(form[key])}
      onChange={(event) => set(key, event.target.value as never)}
      error={errors[key]?.[0]}
      disabled={saving}
      {...extra}
    />
  );
  const area = (key: keyof FormState, label: string, extra: { hint?: string; placeholder?: string; rows?: number; required?: boolean } = {}) => (
    <Textarea
      label={label}
      name={`nv-${key}`}
      value={String(form[key])}
      onChange={(event) => set(key, event.target.value as never)}
      error={errors[key]?.[0]}
      disabled={saving}
      rows={extra.rows ?? 3}
      hint={extra.hint}
      placeholder={extra.placeholder}
      required={extra.required}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <Section title="Basics" description="Which country, its web address, and whether it shows on the website.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {page ? (
            <FormField label="Country" htmlFor="nv-country">
              <input id="nv-country" value={page.country.name} disabled className={cn(fieldControlClass, fieldBorderClass(false))} />
            </FormField>
          ) : (
            <FormField label="Country" htmlFor="nv-country" required error={errors.countryId?.[0]}>
              <select
                id="nv-country"
                value={form.countryId}
                disabled={saving}
                onChange={(event) => {
                  const next = countries.find((option) => option.id === event.target.value);
                  setForm((current) => ({
                    ...current,
                    countryId: event.target.value,
                    slug: current.slug === "" && next ? slugify(next.name) : current.slug,
                    heroTitle: current.heroTitle === "" && next ? `${next.name} Visa Made Simple` : current.heroTitle,
                    heroEyebrow: current.heroEyebrow === "" && next ? `${next.name} Visa` : current.heroEyebrow,
                  }));
                }}
                className={cn(fieldControlClass, fieldBorderClass(!!errors.countryId))}
              >
                <option value="" disabled>
                  Choose a country…
                </option>
                {availableCountries.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.activeProducts === 0 ? " (no visa products yet)" : ""}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          {text("slug", "Web address", { hint: `tripnexio.com/services/new-visa/${form.slug || "…"}`, required: true })}
          {text("displayOrder", "Card order", { hint: "Lower numbers appear first." })}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-hairline px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-primary">Published</p>
              <p className="text-xs text-ink-tertiary">Shows the card and the page on the website.</p>
            </div>
            <Switch checked={form.published} onChange={(on) => set("published", on)} disabled={saving} label="Published" />
          </div>
        </div>
        {country && country.activeProducts === 0 ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning/[0.08] px-3 py-2 text-xs text-warning">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {country.name} has no active visa products yet, so the page won&apos;t show visa options or a price. Add them under
            Service Configuration → New Visa.
          </p>
        ) : null}
        {country && !country.active ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning/[0.08] px-3 py-2 text-xs text-warning">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {country.name} is disabled under Master Data → Countries, so this page stays hidden even when published.
          </p>
        ) : null}
      </Section>

      <Section title="Destination card" description="The card on the New Visa listing page.">
        {text("cardTagline", "Card line", { placeholder: "e.g. Tourist visas for the UAE, applied online" })}
        <ImageField
          label="Card image"
          hint="Landscape photo, about 1200×750. JPEG, PNG or WebP, up to 5MB. Without one, the hero image (or the default photo) is used."
          pageId={page?.id ?? null}
          kind="card"
          fileId={cardImage}
          onChanged={setCardImage}
        />
      </Section>

      <Section title="Top of the page (hero)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("heroEyebrow", "Small label above the heading", { placeholder: "e.g. UAE Visa" })}
          {text("heroTitle", "Heading", { required: true, placeholder: "e.g. UAE Visa Made Simple" })}
        </div>
        {area("heroSubtitle", "Introduction line", { required: true, rows: 2 })}
        <ImageField
          label="Hero image"
          hint="Wide photo, at least 2000px across. JPEG, PNG or WebP, up to 5MB. Without one, the standard New Visa photo is used."
          pageId={page?.id ?? null}
          kind="hero"
          fileId={heroImage}
          onChanged={setHeroImage}
        />
      </Section>

      <Section title="About this visa" description="Leave both empty to hide this section.">
        {text("introHeading", "Heading")}
        {area("introBody", "Text", { rows: 5 })}
      </Section>

      <Section title="Who can apply" description="Leave both empty to hide this section.">
        {text("applicantsHeading", "Heading", { placeholder: "e.g. UAE Visa Applications From Across India" })}
        {area("applicantsBody", "Text", { rows: 2 })}
      </Section>

      <Section title="Requirements" description="One item per line. An empty list hides its part of the section.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {area("whatYouNeed", "What you'll need", { rows: 6 })}
          <div className="flex flex-col gap-2">
            {area("documents", "Documents required", { rows: 6 })}
            <DocumentMasterPicker
              current={form.documents.split("\n")}
              disabled={saving}
              onPick={(name) => set("documents", (form.documents.trim() ? `${form.documents.trim()}\n${name}` : name) as never)}
            />
          </div>
        </div>
        {area("documentsNote", "Documents note", { rows: 2 })}
        {area("childrenNote", "Travelling with children", { rows: 2, hint: "Leave empty to hide this card." })}
      </Section>

      <Section title="Visa validity & stay" description="Leave both empty to hide this section.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {area("validityText", "Visa validity")}
          {area("stayText", "Stay duration")}
        </div>
      </Section>

      <Section title="Important before you apply" description="One point per line. Leave empty to hide.">
        {area("beforeYouApply", "Points", { rows: 5 })}
      </Section>

      <Section title="Bottom call to action" description="Leave empty to use the standard wording.">
        {text("ctaHeading", "Heading")}
        {area("ctaBody", "Text", { rows: 2 })}
      </Section>

      <Section title="Search engines (SEO)" description="Leave empty to use the heading and introduction line.">
        {text("seoTitle", "Page title", { hint: "Up to 70 characters." })}
        {area("seoDescription", "Description", { rows: 2, hint: "Up to 170 characters." })}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-base/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className={cn("text-sm", dirty ? "font-medium text-warning" : "text-ink-tertiary")} aria-live="polite">
          {dirty ? "You have unsaved changes" : page ? "All changes saved" : "Choose a country and fill in the page"}
        </p>
        <div className="flex items-center gap-2">
          {page?.published && !dirty ? (
            <Link
              href={`/services/new-visa/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary hover:border-glass-border"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View page
            </Link>
          ) : null}
          {page ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(initial)} disabled={!dirty || saving}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Discard
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty || (!page && !form.countryId)}>
            {page ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {page ? "Save changes" : "Create page"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NewVisaCountryPagesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [pages, setPages] = useState<CountryPage[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<{ pages: CountryPage[]; countries: CountryOption[] }>("/api/admin/new-visa-pages");
        if (cancelled) return;
        setPages(result.pages);
        setCountries(result.countries);
        setSelectedId((current) => current ?? result.pages[0]?.id ?? NEW);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load country pages. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const takenCountryIds = useMemo(() => new Set(pages.map((page) => page.countryId)), [pages]);

  const select = (id: string) => {
    if (id === selectedId) return;
    if (editorDirty) {
      toast.error("Save or discard your changes first.");
      return;
    }
    setSelectedId(id);
  };

  if (state === "loading") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton className="h-72 w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load country pages"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const selected = pages.find((page) => page.id === selectedId) ?? null;
  const creating = selectedId === NEW || !selected;
  const allTaken = countries.every((country) => takenCountryIds.has(country.id));

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-3 lg:sticky lg:top-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-ink-heading">
            Countries <span className="font-normal text-ink-tertiary">({pages.length})</span>
          </h2>
          <Button type="button" size="sm" variant="ghost" onClick={() => select(NEW)} disabled={allTaken}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New page
          </Button>
        </div>
        {pages.length === 0 ? (
          <EmptyState title="No country pages yet" description="Create the first one to show it on the website." />
        ) : (
          <ul className="flex flex-col gap-1" aria-label="Country pages">
            {pages.map((page) => {
              const active = page.id === selectedId;
              return (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => select(page.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                      active ? "border-accent/30 bg-accent/[0.07]" : "border-transparent hover:bg-ink-primary/[0.03]"
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn("block truncate text-sm font-medium", active ? "text-accent-on-light" : "text-ink-primary")}>
                        {page.country.name}
                      </span>
                      <span className="block truncate text-xs text-ink-tertiary">/{page.slug}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        page.published ? "bg-success/10 text-success" : "bg-ink-primary/[0.06] text-ink-tertiary"
                      )}
                    >
                      {page.published ? "Live" : "Draft"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {creating ? (
          <span className="flex items-center gap-2 rounded-lg border border-dashed border-accent/40 bg-accent/[0.04] px-3 py-2.5 text-sm font-medium text-accent-on-light">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New page (unsaved)
          </span>
        ) : null}
        <p className="rounded-lg bg-ink-primary/[0.03] px-3 py-2 text-xs leading-relaxed text-ink-tertiary">
          Visa products and prices, processing times and FAQs come from their own screens: Service Configuration (New Visa) and
          FAQs (choose the country there).
        </p>
      </aside>

      <PageEditor
        key={creating ? NEW : selected.id}
        page={creating ? null : selected}
        countries={countries}
        takenCountryIds={takenCountryIds}
        onDirtyChange={setEditorDirty}
        onSaved={(updated) => setPages((current) => current.map((page) => (page.id === updated.id ? updated : page)))}
        onCreated={(created) => {
          setEditorDirty(false);
          setPages((current) => [...current, created]);
          setSelectedId(created.id);
        }}
      />
    </div>
  );
}
