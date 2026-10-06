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
  "How many bookings last week?",
  "Show hot leads this month",
  "Show the log of booking …",
  "Any system errors in the last 7 days?",
  "Profit per service report for last month",
  "Show all pending refunds",
  "Show staff workload",
  "Check WhatsApp",
];

type Row = Record<string, unknown>;

function isRowArray(value: unknown): value is Row[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

/** Client corrections 2026-10-05 — answers as readable tables, not raw JSON. */
function FactsTable({ rows, columns }: { rows: Row[]; columns?: string[] }) {
  const keys = Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-hairline bg-surface-2 text-left text-ink-tertiary">
            {keys.map((key, index) => (
              <th key={key} className="px-3 py-2 font-medium whitespace-nowrap">
                {columns?.[index] ?? humanize(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-hairline last:border-b-0">
              {keys.map((key) => (
                <td key={key} className="px-3 py-2 align-top text-ink-secondary">
                  {cellText(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactsView({ facts }: { facts: unknown }) {
  if (isRowArray(facts)) return <FactsTable rows={facts} />;
  if (facts && typeof facts === "object" && !Array.isArray(facts)) {
    const record = facts as Row;
    if (isRowArray(record.rows)) {
      return <FactsTable rows={record.rows} columns={Array.isArray(record.columns) ? (record.columns as string[]) : undefined} />;
    }
    const scalars = Object.entries(record).filter(([, value]) => value === null || typeof value !== "object");
    const nested = Object.entries(record).filter(([, value]) => value !== null && typeof value === "object");
    return (
      <div className="flex flex-col gap-3">
        {scalars.length > 0 ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {scalars.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 border-b border-hairline py-1">
                <dt className="text-ink-tertiary">{humanize(key)}</dt>
                <dd className="font-medium text-ink-primary">{cellText(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {nested.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-ink-heading">{humanize(key)}</p>
            {isRowArray(value) ? (
              <FactsTable rows={value} />
            ) : Array.isArray(value) && value.length === 0 ? (
              <p className="text-xs text-ink-tertiary">None.</p>
            ) : (
              <FactsView facts={value} />
            )}
          </div>
        ))}
      </div>
    );
  }
  return <pre className="max-h-80 overflow-auto rounded-md bg-surface-2 p-3 text-[11px] whitespace-pre-wrap text-ink-secondary">{JSON.stringify(facts, null, 2)}</pre>;
}

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
      {hasFacts ? <FactsView facts={result.facts} /> : null}
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
