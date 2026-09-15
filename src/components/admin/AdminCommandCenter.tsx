"use client";

import { useState } from "react";
import { Send, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface CommandResponse {
  question: string;
  commandType: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  summary: string;
  facts: unknown;
  validationError: string | null;
}

const EXAMPLE_QUESTIONS = [
  "Show all pending refunds",
  "Show me today's failed automations",
  "Check WhatsApp",
  "Show staff workload",
  "Show me today's price changes",
];

function ResultCard({ result }: { result: CommandResponse }) {
  const hasFacts = result.facts !== null && result.facts !== undefined && !(Array.isArray(result.facts) && result.facts.length === 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <p className="text-sm font-medium text-ink-primary">{result.question}</p>
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
          result.validationError ? "bg-warning/10 text-warning" : "bg-ink-accent/5 text-ink-secondary"
        )}
      >
        {result.validationError ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ink-accent" aria-hidden="true" />
        )}
        <span>{result.summary}</span>
      </div>
      {hasFacts ? (
        <details className="text-xs text-ink-tertiary">
          <summary className="cursor-pointer select-none">Underlying data</summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-surface-2 p-3 text-[11px] whitespace-pre-wrap text-ink-secondary">
            {JSON.stringify(result.facts, null, 2)}
          </pre>
        </details>
      ) : null}
      <span className="text-[11px] tracking-wide text-ink-tertiary uppercase">{result.commandType.replaceAll("_", " ")}</span>
    </div>
  );
}

/**
 * Step 27 (audit §4.4) — ADMIN.md §10/§41's natural-language Admin
 * console, read-only queries only in this step. See POST
 * /api/admin/ai-command for the full pipeline this calls into.
 */
export function AdminCommandCenter() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<CommandResponse[]>([]);

  const handleAsk = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAsking(true);
    try {
      const result = await postJson<CommandResponse>("/api/admin/ai-command", { question: trimmed });
      setHistory((current) => [result, ...current]);
      setQuestion("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't process that question. Please try again.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleAsk(question);
        }}
        className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about bookings, refunds, staff workload, integration health…"
            disabled={asking}
            className="h-11 flex-1 rounded-md border border-hairline bg-surface-2 px-3.5 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-ink-accent focus:outline-none"
          />
          <Button type="submit" isLoading={asking} disabled={!question.trim()}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Ask
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUESTIONS.map((example) => (
            <button
              key={example}
              type="button"
              disabled={asking}
              onClick={() => void handleAsk(example)}
              className="rounded-full border border-hairline px-2.5 py-1 text-xs text-ink-tertiary transition-colors duration-150 hover:border-ink-accent hover:text-ink-accent"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {history.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Ask a question above, or try one of the examples.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {history.map((result, index) => (
            <ResultCard key={`${result.question}-${index}`} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
