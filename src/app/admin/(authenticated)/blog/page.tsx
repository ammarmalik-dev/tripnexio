import type { Metadata } from "next";
import { BlogPostsTable } from "@/components/admin/blog/BlogPostsTable";

export const metadata: Metadata = { title: "Blog | Admin" };

export default function AdminBlogPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Blog</h1>
        <p className="text-sm text-ink-tertiary">Write and publish articles for the website blog. New posts start as drafts.</p>
      </div>
      <BlogPostsTable />
    </div>
  );
}
