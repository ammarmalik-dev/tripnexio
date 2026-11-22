"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ApiError, getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
  authorName: string;
}

type StatusFilter = "all" | "PUBLISHED" | "DRAFT";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** Client request 2026-10-06 — Admin → Blog list: one Create button, a compact table, open a post to edit. */
export function BlogPostsTable() {
  const [rows, setRows] = useState<BlogPostRow[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<BlogPostRow[]>("/api/admin/blog");
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load posts.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => (status === "all" ? rows : rows.filter((row) => row.status === status)), [rows, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Status">
          {(["all", "PUBLISHED", "DRAFT"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                status === value ? "bg-ink-accent/10 text-ink-accent" : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              {value === "all" ? "All" : value === "PUBLISHED" ? "Published" : "Drafts"}
            </button>
          ))}
        </div>
        <ButtonLink href="/admin/blog/new" size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Post
        </ButtonLink>
      </div>

      {state === "loading" ? <Skeleton className="h-40 w-full" /> : null}
      {state === "error" ? <ErrorState description={errorMessage} /> : null}
      {state === "success" && visible.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="No posts here yet" description="Create a post to publish it on the website blog." />
      ) : null}
      {state === "success" && visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Last edited</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/blog/${row.id}`} className="font-medium text-ink-accent hover:underline">
                      {row.title}
                    </Link>
                    <div className="text-xs text-ink-tertiary">/blog/{row.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{row.category}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", row.status === "PUBLISHED" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                      {row.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{formatDate(row.publishedAt)}</td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(row.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/blog/${row.id}`} className="font-medium text-ink-accent hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
