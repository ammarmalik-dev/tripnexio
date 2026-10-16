import type { Metadata } from "next";
import { BlogEditor } from "@/components/admin/blog/BlogEditor";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "New Post | Admin" };

export default async function AdminNewBlogPostPage() {
  const used = await db.blogPost.findMany({ distinct: ["category"], select: { category: true } });
  return <BlogEditor post={null} usedCategories={used.map((row) => row.category)} />;
}
