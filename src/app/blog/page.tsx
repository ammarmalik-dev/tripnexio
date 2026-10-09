import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { BlogCard } from "@/components/blog/BlogCard";
import { getPublishedPosts, toCardPost } from "@/lib/blog/queries";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/cn";
import { Search } from "lucide-react";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Travel & Visa Blog",
  description: "Guides on visas, OTB, visa change, flights and travel documents from the TripNexio team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "TripNexio Blog — Travel & Visa Guides",
    description: "Guides on visas, OTB, visa change, flights and travel documents from the TripNexio team.",
    url: `${siteConfig.url}/blog`,
    type: "website",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

interface BlogPageProps {
  searchParams: Promise<{ category?: string; q?: string }>;
}

/**
 * Client request 2026-10-06 — the blog listing with a category filter.
 * Client testing 2026-10-09 (F9) — a search box above the articles, and the
 * cards in rows of four that centre themselves (one card sits in the middle).
 */
export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category, q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 80);
  const posts = await getPublishedPosts();
  const categories = [...new Set(posts.map((post) => post.category))];
  const needle = query.toLowerCase();
  const visible = posts.filter(
    (post) =>
      (!category || post.category === category) &&
      (!needle || `${post.title} ${post.excerpt} ${post.category} ${post.tags.join(" ")}`.toLowerCase().includes(needle))
  );

  return (
    <Container className="py-14 sm:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-wide text-ink-accent uppercase">TripNexio Blog</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-heading sm:text-5xl">Travel &amp; visa guides</h1>
        <p className="mt-4 text-base text-ink-secondary sm:text-lg">
          Clear, practical guides on visas, OTB, visa change and travel documents, written by the TripNexio team.
        </p>
      </header>

      <form action="/blog" role="search" className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="blog-search" className="sr-only">
            Search articles
          </label>
          <input
            id="blog-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search articles"
            className={cn(fieldControlClass, fieldBorderClass(false), "h-12 rounded-full pl-10")}
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-full bg-[image:var(--gradient-accent)] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_rgb(62_111_219/0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Search
        </button>
      </form>

      {categories.length > 1 ? (
        <nav aria-label="Blog categories" className="mt-8 flex flex-wrap justify-center gap-2">
          {[null, ...categories].map((name) => {
            const active = (name ?? undefined) === category;
            return (
              <Link
                key={name ?? "all"}
                href={`/blog${name || query ? `?${new URLSearchParams({ ...(name ? { category: name } : {}), ...(query ? { q: query } : {}) }).toString()}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  active ? "border-transparent bg-[image:var(--gradient-accent)] text-white" : "border-hairline bg-surface-1 text-ink-secondary hover:text-ink-primary"
                )}
              >
                {name ?? "All"}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="mt-10">
        {visible.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-6">
            {visible.map((post) => (
              <li key={post.id} className="flex w-full sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)]">
                <BlogCard post={toCardPost(post)} />
              </li>
            ))}
          </ul>
        ) : posts.length > 0 ? (
          <EmptyState
            title="No matching articles"
            description="Try a different word or category."
            action={<ButtonLink href="/blog">Show all articles</ButtonLink>}
          />
        ) : (
          <EmptyState
            title="No articles yet"
            description="We haven't published anything here yet. Check back soon, or browse our services."
            action={<ButtonLink href="/services">Browse Services</ButtonLink>}
          />
        )}
      </div>
    </Container>
  );
}
