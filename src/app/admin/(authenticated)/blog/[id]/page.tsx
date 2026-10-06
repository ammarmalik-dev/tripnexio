import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogEditor } from "@/components/admin/blog/BlogEditor";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Edit Post | Admin" };

interface AdminBlogPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminBlogPostPage({ params }: AdminBlogPostPageProps) {
  if (!hasPermission(await getStaffSession(), "masters.manage")) notFound();
  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) notFound();
  return <BlogEditor post={{ ...post, publishedAt: post.publishedAt?.toISOString() ?? null }} />;
}
