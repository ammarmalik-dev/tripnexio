"use client";

import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, RotateCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "@/generated/prisma/enums";
import { CommunicationsPanel } from "./CommunicationsPanel";

interface ChatRow {
  waId: string;
  customerName: string;
  withTeam: boolean;
  lastInboundAt: string | null;
  lastMessage: { body: string; direction: "INBOUND" | "OUTBOUND"; at: string } | null;
  lead: { id: string; reference: string | null; serviceType: ServiceType; poc: string | null };
  booking: { id: string; bookingId: string } | null;
}

const REFRESH_MS = 30_000;

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Client doc 2026-10-20 (G3 / G4) — the CRM chat window: conversations on the left (chats with the team
 * first), the selected chat on the right with the reply box, and its booking / lead one click away.
 */
export function WhatsAppChats() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [ending, setEnding] = useState(false);
  // null = pick automatically: Agent chats when there are any, else Bot chats.
  const [chosenSection, setSection] = useState<"agent" | "bot" | null>(null);
  const [query, setQuery] = useState("");

  // Client doc 16 Nov (L1) — opening the chats clears their alerts on the menu item.
  useEffect(() => {
    void postJson("/api/crm/notifications/read", { type: "WHATSAPP_CHAT" }).catch(() => undefined);
  }, [nonce]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<ChatRow[]>("/api/crm/whatsapp-chats");
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the chats.");
        setState("error");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [nonce]);

  if (state === "loading") return <Skeleton className="h-96 w-full" />;
  if (state === "error") {
    return (
      <ErrorState
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title="No WhatsApp chats yet" description="Conversations appear here as customers message the TripNexio WhatsApp number." />;
  }

  // Client doc 16 Nov (L1) — Agent chats (handed to the team) and Bot chats apart; a search to open one directly.
  const term = query.trim().toLowerCase();
  const matches = (row: ChatRow) =>
    !term || [row.customerName, row.waId, row.lead.reference ?? "", row.booking?.bookingId ?? ""].some((value) => value.toLowerCase().includes(term));
  const agentCount = rows.filter((row) => row.withTeam).length;
  const section = chosenSection ?? (agentCount > 0 ? "agent" : "bot");
  const listed = rows.filter((row) => (section === "agent" ? row.withTeam : !row.withTeam) && matches(row));
  // The open chat is always one from the list shown.
  const active = listed.find((row) => row.waId === selected) ?? listed[0] ?? null;
  const popOut = (leadId: string) => {
    window.open(`/crm/chat-window/${leadId}`, `tn-chat-${leadId}`, "width=460,height=720,noopener=no");
  };

  // Client doc 2026-10-20 (G4) — the agent closes the conversation; the bot answers the customer again.
  const endChat = async (waId: string) => {
    setEnding(true);
    try {
      await postJson(`/api/crm/whatsapp-chats/${waId}/end`, {});
      toast.success("Chat ended — the WhatsApp bot answers this customer again.");
      setNonce((n) => n + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't end the chat. Please try again.");
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-2">
        <div role="tablist" aria-label="Chat type" className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {(
            [
              ["agent", `Agent chats (${agentCount})`],
              ["bot", `Bot chats (${rows.length - agentCount})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={section === value}
              onClick={() => setSection(value)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                section === value ? "bg-surface-1 text-ink-heading shadow-sm" : "text-ink-tertiary hover:text-ink-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label htmlFor="whatsapp-chat-search" className="sr-only">
          Find a chat
        </label>
        <input
          id="whatsapp-chat-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, number, lead or booking ID"
          className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm")}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-tertiary">{listed.length} chats</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNonce((n) => n + 1)}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
        <ul className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto">
          {listed.length === 0 ? <li className="px-1 py-3 text-xs text-ink-tertiary">No chats here.</li> : null}
          {listed.map((row) => (
            <li key={row.waId}>
              <button
                type="button"
                onClick={() => setSelected(row.waId)}
                aria-current={row.waId === active?.waId ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                  row.waId === active?.waId ? "border-accent/40 bg-accent/5" : "border-hairline bg-surface-1 hover:bg-surface-2"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-heading">{row.customerName}</span>
                  {row.withTeam ? <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">Wants an agent</span> : null}
                </span>
                <span className="truncate text-xs text-ink-secondary">
                  {row.lastMessage ? `${row.lastMessage.direction === "OUTBOUND" ? "You: " : ""}${row.lastMessage.body}` : "No messages"}
                </span>
                <span className="text-[11px] text-ink-tertiary">
                  {row.booking?.bookingId ?? row.lead.reference ?? "New request"} · {SERVICE_TYPE_LABELS[row.lead.serviceType]}
                  {row.lastInboundAt ? ` · ${when(row.lastInboundAt)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!active ? (
        <section className="flex items-center justify-center rounded-xl border border-dashed border-hairline bg-surface-1 p-8 text-sm text-ink-tertiary">
          {section === "agent" ? "No customer is waiting for an agent right now." : "No bot chats match."}
        </section>
      ) : (
      <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-ink-accent" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-ink-heading">{active.customerName}</h2>
              <p className="text-xs text-ink-tertiary">
                +{active.waId} · POC {active.lead.poc ?? "unassigned"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {active.withTeam ? (
              <Button type="button" size="sm" variant="ghost" disabled={ending} onClick={() => void endChat(active.waId)}>
                {ending ? "Ending..." : "End chat"}
              </Button>
            ) : null}
            {active.booking ? (
              <Link href={`/crm/bookings/${active.booking.id}#tab-communication`} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white">
                Open booking {active.booking.bookingId}
              </Link>
            ) : null}
            {/* Client doc 16 Nov (L1) — keep chatting in a small window while working elsewhere in the CRM. */}
            <Button type="button" size="sm" variant="ghost" onClick={() => popOut(active.lead.id)}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Pop out
            </Button>
            <Link href={`/crm/leads/${active.lead.id}#tab-communication`} className="inline-flex h-8 items-center rounded-md border border-hairline px-3 text-xs font-semibold text-ink-primary">
              Open lead {active.lead.reference ?? ""}
            </Link>
          </div>
        </div>
        <CommunicationsPanel key={active.lead.id} leadId={active.lead.id} />
      </section>
      )}
    </div>
  );
}
