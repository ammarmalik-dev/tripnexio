import { db } from "../db";
import { blogCoverSrc, readingMinutes } from "./blog";
import type { BlogPost } from "../../generated/prisma/client";

/** Published posts, newest first. Never throws: a DB problem renders the blog as empty, not an error page. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    return await db.blogPost.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] });
  } catch (error) {
    console.error("[blog] couldn't load posts", error);
    return [];
  }
}

export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  try {
    return await db.blogPost.findFirst({ where: { slug, status: "PUBLISHED" } });
  } catch (error) {
    console.error("[blog] couldn't load post", error);
    return null;
  }
}

export function toCardPost(post: BlogPost) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    coverSrc: blogCoverSrc(post),
    coverAlt: post.coverImageAlt ?? post.title,
    publishedAt: post.publishedAt,
    minutes: readingMinutes(post.body),
  };
}
