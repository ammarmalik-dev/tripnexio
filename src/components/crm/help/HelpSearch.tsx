"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, HelpCircle } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { KNOWLEDGE_ARTICLE_CATEGORY_LABELS, SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { KnowledgeArticleCategory, ServiceType } from "../../../generated/prisma/enums";

interface HelpSearchResponse {
  knowledgeSearched: boolean;
  knowledge: { id: string; title: string; category: KnowledgeArticleCategory; snippet: string }[];
  faqs: { id: string; question: string; answer: string; serviceType: ServiceType | null; category: string | null }[];
}

type SearchState = "idle" | "loading" | "success" | "error";

const MIN_QUERY_LENGTH = 2;

/** P22 item 2 — searches the Knowledge Centre + published FAQs together (GET /api/crm/help/search). */
export function HelpSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<HelpSearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (debouncedQuery.length < MIN_QUERY_LENGTH) {
        setState("idle");
        setResult(null);
        return;
      }
      setState("loading");
      try {
        const data = await getJson<HelpSearchResponse>(`/api/crm/help/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (cancelled) return;
        setResult(data);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Search failed. Please try again.");
        setState("error");
      }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, retryNonce]);

  const hasResults = result !== null && (result.knowledge.length > 0 || result.faqs.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor="help-search" className="sr-only">
          Search the Knowledge Centre and FAQs
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SOPs, staff FAQ, training material and customer FAQs…"
          autoComplete="off"
          className={cn(fieldControlClass, fieldBorderClass(false), "pl-10")}
        />
      </div>

      {state === "idle" ? (
        <p className="text-sm text-ink-tertiary">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
      ) : null}

      {state === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Searching">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Search failed"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setRetryNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && !hasResults ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title={`No results for "${debouncedQuery}"`}
          description="Try a different word, or report an issue below if you're stuck."
        />
      ) : null}

      {state === "success" && result && hasResults ? (
        <div className="flex flex-col gap-6">
          {result.knowledgeSearched ? (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-heading">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Knowledge Centre ({result.knowledge.length})
              </h3>
              {result.knowledge.length === 0 ? (
                <p className="text-sm text-ink-tertiary">No Knowledge Centre articles match.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {result.knowledge.map((article) => (
                    <li key={article.id} className="rounded-lg border border-hairline bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href="/crm/knowledge-centre" className="text-sm font-medium text-ink-accent hover:underline">
                          {article.title}
                        </Link>
                        <span className="text-xs text-ink-tertiary">{KNOWLEDGE_ARTICLE_CATEGORY_LABELS[article.category]}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-secondary">{article.snippet}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-heading">
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              Customer FAQs ({result.faqs.length})
            </h3>
            {result.faqs.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No published FAQs match.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {result.faqs.map((faq) => (
                  <li key={faq.id} className="rounded-lg border border-hairline bg-surface-1">
                    <details className="group p-3">
                      <summary className="cursor-pointer list-none text-sm font-medium text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {faq.question}
                        <span className="ml-2 text-xs font-normal text-ink-tertiary">
                          {faq.serviceType ? SERVICE_TYPE_LABELS[faq.serviceType] : "General"}
                        </span>
                      </summary>
                      <p className="mt-2 whitespace-pre-line text-sm text-ink-secondary">{faq.answer}</p>
                      <Link href="/faq" className="mt-2 inline-block text-xs text-ink-accent hover:underline" target="_blank" rel="noopener">
                        View on the public FAQ page
                      </Link>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
