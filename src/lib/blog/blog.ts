import { z } from "zod";
import { parseLegalMarkup } from "../legal/markup";

/**
 * Client request 2026-10-06 — the website blog. Shared by the public pages,
 * the Admin editor and the APIs. The body uses the Legal Pages text format
 * (## heading, - bullet, **bold**, [link](/path)), so posts can never inject
 * HTML.
 */

/** Built-in site photos Admin can pick as a cover without uploading anything. */
export const BUILT_IN_COVERS: { url: string; label: string }[] = [
  { url: "/images/hero/home.jpg", label: "Homepage hero" },
  { url: "/images/services/new-visa.jpg", label: "New Visa" },
  { url: "/images/services/visa-extension.jpg", label: "Visa Extension" },
  { url: "/images/services/flight-special-fare.jpg", label: "Flight Special Fare" },
  { url: "/images/services/return-ticket.jpg", label: "Return Ticket" },
  { url: "/images/services/otb.jpg", label: "OTB" },
];

export const BLOG_CATEGORIES = ["Visa Guides", "Flights & OTB", "Travel Tips", "TripNexio Updates"] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogPostSchema = z.object({
  title: z.string().trim().min(5, "Enter a title (at least 5 characters)").max(140, "Title is too long"),
  slug: z.string().trim().min(3, "Enter a URL slug").max(100, "Slug is too long").regex(slugPattern, "Use lowercase letters, numbers and hyphens only"),
  excerpt: z.string().trim().min(20, "Write a short summary (at least 20 characters)").max(300, "Summary is too long (max 300)"),
  body: z.string().trim().min(100, "The article is too short (at least 100 characters)").max(60_000, "The article is too long"),
  category: z.string().trim().min(2, "Pick a category").max(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(12, "Use at most 12 tags").default([]),
  coverImageUrl: z
    .string()
    .trim()
    .refine((value) => value === "" || BUILT_IN_COVERS.some((cover) => cover.url === value), "Pick one of the site photos or upload a cover")
    .nullable()
    .optional(),
  coverImageAlt: z.string().trim().max(160, "Alt text is too long").nullable().optional(),
  authorName: z.string().trim().min(2).max(80).default("TripNexio Team"),
  seoTitle: z.string().trim().max(70, "SEO title: keep it under 70 characters").nullable().optional(),
  seoDescription: z.string().trim().max(170, "SEO description: keep it under 170 characters").nullable().optional(),
});

export const updateBlogPostSchema = blogPostSchema.partial();
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100)
    .replace(/^-|-$/g, "");
}

/** ~200 words a minute, at least 1. */
export function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** The article's section headings (for the table of contents) with stable anchor ids. */
export function blogHeadings(body: string): { id: string; text: string }[] {
  const seen = new Map<string, number>();
  return parseLegalMarkup(body)
    .filter((block): block is { type: "heading"; text: string } => block.type === "heading")
    .map((block) => {
      const base = slugify(block.text) || "section";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { id: count ? `${base}-${count + 1}` : base, text: block.text };
    });
}

/** The public URL of a post's cover: the uploaded file (served while published) or the built-in photo. */
export function blogCoverSrc(post: { id: string; coverFileUrl: string | null; coverImageUrl: string | null }): string | null {
  if (post.coverFileUrl) return `/api/blog/cover/${post.id}`;
  return post.coverImageUrl || null;
}
