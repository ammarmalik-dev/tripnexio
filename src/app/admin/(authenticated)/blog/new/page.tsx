import type { Metadata } from "next";
import { BlogEditor } from "@/components/admin/blog/BlogEditor";

export const metadata: Metadata = { title: "New Post | Admin" };

export default function AdminNewBlogPostPage() {
  return <BlogEditor post={null} />;
}
