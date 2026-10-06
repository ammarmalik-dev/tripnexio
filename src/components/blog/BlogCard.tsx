import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

export interface BlogCardPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverSrc: string | null;
  coverAlt: string;
  publishedAt: Date | null;
  minutes: number;
}

export function formatBlogDate(date: Date | null): string {
  return date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

/** A post card on /blog and in "Related articles". `featured` = the large first card. */
export function BlogCard({ post, featured = false }: { post: BlogCardPost; featured?: boolean }) {
  return (
    <article
      className={cn(
        "group flex overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_8px_24px_rgb(24_42_77/0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgb(24_42_77/0.12)]",
        featured ? "flex-col lg:flex-row" : "flex-col"
      )}
    >
      <Link href={`/blog/${post.slug}`} className={cn("relative block shrink-0 overflow-hidden bg-surface-2", featured ? "aspect-[16/9] lg:aspect-auto lg:w-[55%]" : "aspect-[16/9]")} tabIndex={-1} aria-hidden="true">
        {post.coverSrc ? (
          <Image
            src={post.coverSrc}
            alt=""
            fill
            sizes={featured ? "(min-width: 1024px) 640px, 100vw" : "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={featured}
            unoptimized={post.coverSrc.startsWith("/api/")}
          />
        ) : null}
      </Link>
      <div className={cn("flex flex-1 flex-col gap-3", featured ? "p-6 sm:p-8" : "p-5")}>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full bg-ink-accent/10 px-2.5 py-1 font-semibold text-ink-accent">{post.category}</span>
          <span className="inline-flex items-center gap-1 text-ink-tertiary">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {post.minutes} min read
          </span>
        </div>
        <h3 className={cn("font-semibold tracking-tight text-ink-heading", featured ? "text-2xl sm:text-3xl" : "text-lg")}>
          <Link href={`/blog/${post.slug}`} className="hover:text-ink-accent">
            {post.title}
          </Link>
        </h3>
        <p className={cn("text-ink-secondary", featured ? "text-base" : "line-clamp-3 text-sm")}>{post.excerpt}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <time className="text-ink-tertiary" dateTime={post.publishedAt?.toISOString()}>
            {formatBlogDate(post.publishedAt)}
          </time>
          <Link href={`/blog/${post.slug}`} className="inline-flex items-center gap-1 font-semibold text-ink-accent">
            Read article
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
