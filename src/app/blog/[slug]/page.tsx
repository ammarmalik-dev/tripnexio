import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MessageCircle, UserRound } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import { BlogCard, formatBlogDate } from "@/components/blog/BlogCard";
import { blogCoverSrc, blogHeadings, readingMinutes } from "@/lib/blog/blog";
import { getPublishedPost, getPublishedPosts, toCardPost } from "@/lib/blog/queries";
import { siteConfig } from "@/lib/site-config";

export const revalidate = 300;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Article not found" };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  const cover = blogCoverSrc(post);
  return {
    title,
    description,
    keywords: post.tags,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteConfig.url}/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.authorName],
      tags: post.tags,
      ...(cover ? { images: [{ url: `${siteConfig.url}${cover}`, alt: post.coverImageAlt ?? post.title }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Client request 2026-10-06 — one blog article: cover, meta, table of contents, body, CTA and related posts. */
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const cover = blogCoverSrc(post);
  const headings = blogHeadings(post.body);
  const minutes = readingMinutes(post.body);
  const all = await getPublishedPosts();
  const related = [...all.filter((other) => other.id !== post.id && other.category === post.category), ...all.filter((other) => other.id !== post.id && other.category !== post.category)].slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: post.authorName },
    publisher: { "@type": "Organization", name: siteConfig.name, logo: { "@type": "ImageObject", url: `${siteConfig.url}/og-image.png` } },
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
    ...(cover ? { image: `${siteConfig.url}${cover}` } : {}),
    keywords: post.tags.join(", "),
  };

  return (
    <article className="pb-16">
      {/* JSON-LD for search engines; built from server data only. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Container className="pt-10 sm:pt-14">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-tertiary">
          <Link href="/blog" className="inline-flex items-center gap-1 hover:text-ink-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Blog
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="hover:text-ink-primary">
            {post.category}
          </Link>
        </nav>

        <header className="mx-auto mt-6 max-w-3xl text-center">
          <span className="rounded-full bg-ink-accent/10 px-3 py-1 text-xs font-semibold text-ink-accent">{post.category}</span>
          <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-ink-heading sm:text-[44px]">{post.title}</h1>
          <p className="mt-4 text-base text-ink-secondary sm:text-lg">{post.excerpt}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              {post.authorName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <time dateTime={post.publishedAt?.toISOString()}>{formatBlogDate(post.publishedAt)}</time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {minutes} min read
            </span>
          </div>
        </header>

        {cover ? (
          <div className="relative mx-auto mt-10 aspect-[21/9] max-w-5xl overflow-hidden rounded-3xl bg-surface-2 shadow-[0_18px_40px_rgb(24_42_77/0.12)]">
            <Image src={cover} alt={post.coverImageAlt ?? post.title} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" unoptimized={cover.startsWith("/api/")} />
          </div>
        ) : null}

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[1fr_240px]">
          <div className="min-w-0">
            <BlogArticleBody body={post.body} />
            {post.tags.length > 0 ? (
              <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-hairline bg-surface-1 px-3 py-1 text-xs text-ink-secondary">
                    #{tag}
                  </li>
                ))}
              </ul>
            ) : null}

            <aside className="surface-dark-block mt-12 flex flex-col items-start gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-lg font-semibold text-ink-on-dark-primary">Need help with your travel plans?</p>
                <p className="mt-1 text-sm text-ink-on-dark-secondary">Start a request online and our team will take it from there.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/services">Explore Services</ButtonLink>
                <ButtonLink href="/whatsapp-support" variant="ghost" className="text-ink-on-dark-primary">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Support
                </ButtonLink>
              </div>
            </aside>
          </div>

          {headings.length > 1 ? (
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-28 rounded-2xl border border-hairline bg-surface-1 p-5">
                <p className="text-xs font-semibold tracking-wide text-ink-tertiary uppercase">On this page</p>
                <ol className="mt-3 flex flex-col gap-2 text-sm">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a href={`#${heading.id}`} className="text-ink-secondary hover:text-ink-accent">
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          ) : null}
        </div>
      </Container>

      {related.length > 0 ? (
        <Container className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">Related articles</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((other) => (
              <BlogCard key={other.id} post={toCardPost(other)} />
            ))}
          </div>
        </Container>
      ) : null}
    </article>
  );
}
