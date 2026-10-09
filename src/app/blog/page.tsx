import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { BlogCard } from "@/components/blog/BlogCard";
import { getPublishedPosts, toCardPost } from "@/lib/blog/queries";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/cn";

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
  searchParams: Promise<{ category?: string }>;
}

/** Client request 2026-10-06 — the blog listing: featured latest post, category filter, post grid. */
export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category } = await searchParams;
  const posts = await getPublishedPosts();
  const categories = [...new Set(posts.map((post) => post.category))];
  const visible = category ? posts.filter((post) => post.category === category) : posts;
  const [featured, ...rest] = visible;

  return (
    <Container className="py-14 sm:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-wide text-ink-accent uppercase">TripNexio Blog</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-heading sm:text-5xl">Travel &amp; visa guides</h1>
        <p className="mt-4 text-base text-ink-secondary sm:text-lg">
          Clear, practical guides on visas, OTB, visa change and travel documents, written by the TripNexio team.
        </p>
      </header>

      {categories.length > 1 ? (
        <nav aria-label="Blog categories" className="mt-8 flex flex-wrap justify-center gap-2">
          {[null, ...categories].map((name) => {
            const active = (name ?? undefined) === category;
            return (
              <Link
                key={name ?? "all"}
                href={name ? `/blog?category=${encodeURIComponent(name)}` : "/blog"}
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

      <div className="mt-10 flex flex-col gap-8">
        {featured ? (
          <>
            <BlogCard post={toCardPost(featured)} featured />
            {rest.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <BlogCard key={post.id} post={toCardPost(post)} />
                ))}
              </div>
            ) : null}
          </>
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
