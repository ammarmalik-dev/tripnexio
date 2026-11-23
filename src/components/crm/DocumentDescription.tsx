"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

/** One fetch of the Document Master per page, shared by every row. */
let cache: Promise<Map<string, string>> | null = null;

function loadDescriptions(): Promise<Map<string, string>> {
  if (!cache) {
    cache = getJson<{ name: string; description: string | null }[]>("/api/document-types")
      .then((rows) => new Map(rows.filter((row) => row.description).map((row) => [row.name.trim().toLowerCase(), row.description as string])))
      .catch(() => {
        cache = null;
        return new Map<string, string>();
      });
  }
  return cache;
}

/**
 * Client doc 16 Nov (F10 / G10) — a document's Document Master description under its name in the CRM (the website
 * checkout shows it too). Nothing when the document has no description.
 */
export function DocumentDescription({ type, className }: { type: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const map = await loadDescriptions();
      if (!cancelled) setText(map.get(type.trim().toLowerCase()) ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [type]);
  if (!text) return null;
  return <span className={className ?? "basis-full text-xs text-ink-tertiary"}>{text}</span>;
}
