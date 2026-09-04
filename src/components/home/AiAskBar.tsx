"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { utilityLinks } from "@/lib/nav-config";

export function AiAskBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `${utilityLinks.askAi.href}?q=${encodeURIComponent(trimmed)}` : utilityLinks.askAi.href);
  };

  return (
    <GlassCard tier="overlay" className="w-full rounded-2xl p-2 sm:p-2.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
        <Sparkles className="ml-2 h-5 w-5 shrink-0 text-accent-on-light" aria-hidden="true" />
        <label htmlFor="ai-ask-input" className="sr-only">
          Ask TripNexio AI
        </label>
        <input
          id="ai-ask-input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask anything with TripNexio…"
          className="h-11 flex-1 min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none sm:h-12 sm:text-base"
        />
        <button
          type="submit"
          aria-label="Ask TripNexio AI"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_24px_-8px_rgb(62_111_219_/_55%)] bg-[image:var(--gradient-accent)] transition-transform duration-150 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </GlassCard>
  );
}
