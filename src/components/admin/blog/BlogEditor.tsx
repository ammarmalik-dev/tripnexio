"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ExternalLink, Eye, ImagePlus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { SelectField } from "@/components/forms/SelectField";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { ApiError, deleteJson, patchJson, postJson } from "@/lib/api/client";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { BLOG_CATEGORIES, BUILT_IN_COVERS, blogPostSchema, readingMinutes, slugify } from "@/lib/blog/blog";
import { cn } from "@/lib/cn";

/** The editor's form: tags typed as one comma-separated line, everything else as in blogPostSchema. */
const editorSchema = blogPostSchema.extend({
  tags: z.string().max(400),
  authorName: z.string().trim().min(2, "Enter the author name").max(80),
  coverImageUrl: z.string(),
  coverImageAlt: z.string().max(160),
  seoTitle: z.string().max(70, "Keep it under 70 characters"),
  seoDescription: z.string().max(170, "Keep it under 170 characters"),
});
type EditorValues = z.infer<typeof editorSchema>;

export interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  coverImageUrl: string | null;
  coverFileUrl: string | null;
  coverImageAlt: string | null;
  authorName: string;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
}

const BODY_HELP = "## Heading · blank line = new paragraph · - bullet · **bold** · [link text](/services/otb)";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Client request 2026-10-06 — Admin → Blog editor: write, preview, publish.
 * New posts are saved as drafts; Publish / Unpublish / Delete are separate,
 * audited actions.
 */
export function BlogEditor({ post }: { post: BlogPostData | null }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmAction();
  const [saved, setSaved] = useState<BlogPostData | null>(post);
  const [busy, setBusy] = useState<"save" | "publish" | "cover" | "delete" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(post));

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      title: post?.title ?? "",
      slug: post?.slug ?? "",
      excerpt: post?.excerpt ?? "",
      body: post?.body ?? "",
      category: post?.category ?? BLOG_CATEGORIES[0],
      tags: post?.tags.join(", ") ?? "",
      coverImageUrl: post?.coverImageUrl ?? "",
      coverImageAlt: post?.coverImageAlt ?? "",
      authorName: post?.authorName ?? "TripNexio Team",
      seoTitle: post?.seoTitle ?? "",
      seoDescription: post?.seoDescription ?? "",
    },
  });
  const values = useWatch({ control });

  const toPayload = (form: EditorValues) => ({
    ...form,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    coverImageUrl: form.coverImageUrl || null,
    coverImageAlt: form.coverImageAlt.trim() || null,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
  });

  const onSave = handleSubmit(async (form) => {
    setBusy("save");
    try {
      const result = saved
        ? await patchJson<BlogPostData>(`/api/admin/blog/${saved.id}`, toPayload(form))
        : await postJson<BlogPostData>("/api/admin/blog", toPayload(form));
      toast.success(saved ? "Post saved." : "Draft created.");
      setSaved(result);
      reset(form);
      if (!saved) router.replace(`/admin/blog/${result.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.[0]) setError(field as keyof EditorValues, { message: messages[0] });
        }
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the post.");
    } finally {
      setBusy(null);
    }
  });

  const togglePublish = async () => {
    if (!saved) return;
    if (isDirty) {
      toast.error("Save your changes first.");
      return;
    }
    setBusy("publish");
    try {
      const publish = saved.status !== "PUBLISHED";
      const result = await postJson<BlogPostData>(`/api/admin/blog/${saved.id}/publish`, { publish });
      setSaved(result);
      toast.success(publish ? "Published — it's live on the blog." : "Unpublished — back to draft.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the status.");
    } finally {
      setBusy(null);
    }
  };

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !saved) return;
    setBusy("cover");
    try {
      const result = await postJson<BlogPostData>(`/api/admin/blog/${saved.id}/cover`, { imageBase64: await readAsBase64(file) });
      setSaved(result);
      toast.success("Cover uploaded.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the cover.");
    } finally {
      setBusy(null);
    }
  };

  const removeUploadedCover = async () => {
    if (!saved) return;
    setBusy("cover");
    try {
      setSaved(await postJson<BlogPostData>(`/api/admin/blog/${saved.id}/cover`, { imageBase64: null }));
      toast.success("Uploaded cover removed.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the cover.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!saved) return;
    const reason = await confirm({
      title: "Delete this post?",
      description: "The article is removed from the blog and can't be restored.",
      confirmLabel: "Delete post",
    });
    if (!reason) return;
    setBusy("delete");
    try {
      await deleteJson(withReasonQuery(`/api/admin/blog/${saved.id}`, reason));
      toast.success("Post deleted.");
      router.push("/admin/blog");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the post.");
      setBusy(null);
    }
  };

  const titleField = register("title", {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (!slugTouched) setValue("slug", slugify(event.target.value), { shouldDirty: true });
    },
  });
  const slugField = register("slug", { onChange: () => setSlugTouched(true) });
  const coverPreview = saved?.coverFileUrl ? `/api/blog/cover/${saved.id}` : values.coverImageUrl || null;

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All posts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {saved ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                saved.status === "PUBLISHED" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {saved.status === "PUBLISHED" ? "Published" : "Draft"}
            </span>
          ) : null}
          {saved?.status === "PUBLISHED" ? (
            <Link href={`/blog/${saved.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-ink-accent hover:underline">
              View live
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((current) => !current)}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            {showPreview ? "Hide preview" : "Preview"}
          </Button>
          <Button type="button" size="sm" onClick={() => void onSave()} isLoading={busy === "save"}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saved ? "Save" : "Save draft"}
          </Button>
          {saved ? (
            <Button type="button" size="sm" variant={saved.status === "PUBLISHED" ? "ghost" : "primary"} onClick={() => void togglePublish()} isLoading={busy === "publish"}>
              {saved.status === "PUBLISHED" ? <Undo2 className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {saved.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-5", showPreview && "xl:grid-cols-2")}>
        <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
          <TextField {...titleField} name="title" label="Title" required error={errors.title?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField {...slugField} name="slug" label="URL slug" required hint={`tripnexio.com/blog/${values.slug || "…"}`} error={errors.slug?.message} />
            {/* Client testing 2026-10-09 (F9) — pick a category or type a new one. */}
            <TextField
              {...register("category")}
              name="category"
              label="Category"
              list="blog-category-options"
              hint="Pick one or type a new category."
              error={errors.category?.message}
            />
            <datalist id="blog-category-options">
              {BLOG_CATEGORIES.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <Textarea {...register("excerpt")} name="excerpt" label="Summary" rows={2} required hint="Shown on the blog cards and under the title (20–300 characters)." error={errors.excerpt?.message} />
          <Textarea
            {...register("body")}
            name="body"
            label="Article"
            rows={18}
            required
            hint={`${BODY_HELP} · about ${readingMinutes(values.body ?? "")} min read`}
            error={errors.body?.message}
            className="font-mono text-[13px]"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField {...register("tags")} name="tags" label="Tags" hint="Comma-separated, e.g. OTB, UAE, airlines" error={errors.tags?.message} />
            <TextField {...register("authorName")} name="authorName" label="Author" error={errors.authorName?.message} />
          </div>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
            <legend className="px-1 text-sm font-semibold text-ink-heading">Cover image</legend>
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-only preview of a site photo or the post's own upload
              <img src={coverPreview} alt="" className="aspect-[21/9] w-full rounded-lg object-cover" />
            ) : (
              <p className="text-xs text-ink-tertiary">No cover yet.</p>
            )}
            {saved?.coverFileUrl ? (
              <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
                Using your uploaded image.
                <Button type="button" size="sm" variant="ghost" onClick={() => void removeUploadedCover()} isLoading={busy === "cover"}>
                  Remove upload
                </Button>
              </div>
            ) : (
              <SelectField
                {...register("coverImageUrl")}
                name="coverImageUrl"
                label="Site photo"
                placeholder="None"
                options={BUILT_IN_COVERS.map((cover) => ({ value: cover.url, label: cover.label }))}
                error={errors.coverImageUrl?.message}
              />
            )}
            {saved ? (
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-hairline px-3 py-1.5 text-sm font-medium text-ink-accent hover:bg-ink-primary/[0.03]">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {busy === "cover" ? "Uploading…" : "Upload your own (JPEG/PNG/WebP, max 8MB)"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadCover(event)} disabled={busy === "cover"} />
              </label>
            ) : (
              <p className="text-xs text-ink-tertiary">Save the draft first to upload your own image.</p>
            )}
            <TextField {...register("coverImageAlt")} name="coverImageAlt" label="Image description (alt text)" hint="Describes the image for screen readers and search engines." error={errors.coverImageAlt?.message} />
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
            <legend className="px-1 text-sm font-semibold text-ink-heading">Search engines (optional)</legend>
            <TextField {...register("seoTitle")} name="seoTitle" label="SEO title" hint={`${(values.seoTitle ?? "").length}/70 — blank uses the post title`} error={errors.seoTitle?.message} />
            <Textarea {...register("seoDescription")} name="seoDescription" label="SEO description" rows={2} hint={`${(values.seoDescription ?? "").length}/170 — blank uses the summary`} error={errors.seoDescription?.message} />
          </fieldset>

          {saved ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" className="text-error" onClick={() => void remove()} isLoading={busy === "delete"}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete post
              </Button>
            </div>
          ) : null}
        </form>

        {showPreview ? (
          <section aria-label="Preview" className="rounded-xl border border-hairline bg-surface-1 p-6">
            <p className="text-xs font-semibold text-ink-accent">{values.category}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-heading">{values.title || "Untitled"}</h2>
            <p className="mt-2 text-ink-secondary">{values.excerpt}</p>
            <div className="mt-6">
              <BlogArticleBody body={values.body ?? ""} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
