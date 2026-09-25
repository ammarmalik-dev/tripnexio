"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Mail, MessageCircle, RotateCw, Sparkles } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { DRAFT_TYPE_OPTIONS, type DraftType } from "@/lib/drafting/draft-types";

type Channel = "EMAIL" | "WHATSAPP";
type EmailStatus = "EMAIL_SENT" | "EMAIL_SKIPPED" | "EMAIL_FAILED";

interface CommunicationItem {
  id: string;
  channel: Channel;
  direction: "OUTBOUND" | "INBOUND";
  status: EmailStatus | null;
  body: string;
  sentBy: string | null;
  timestamp: string;
}

interface CommunicationsResponse {
  customer: { email: string | null; mobile: string };
  whatsapp: { windowOpen: boolean; windowExpiresAt: string | null };
  items: CommunicationItem[];
}

type FetchState = "loading" | "success" | "error";
type ChannelFilter = "ALL" | Channel;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  EMAIL_SENT: "Sent",
  EMAIL_SKIPPED: "Skipped",
  EMAIL_FAILED: "Failed",
};

function CommunicationRow({ item }: { item: CommunicationItem }) {
  const isInbound = item.direction === "INBOUND";
  return (
    <li className="flex gap-3">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.channel === "EMAIL" ? "bg-accent" : "bg-success")} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-sm text-ink-primary">
          {item.channel === "EMAIL" ? <Mail className="h-3.5 w-3.5 text-ink-tertiary" aria-hidden="true" /> : <MessageCircle className="h-3.5 w-3.5 text-ink-tertiary" aria-hidden="true" />}
          <span className="font-medium">{isInbound ? "Customer" : item.sentBy ? item.sentBy : "Automated"}</span>
          {item.status ? <span className="text-xs text-ink-tertiary">· {EMAIL_STATUS_LABELS[item.status]}</span> : null}
        </p>
        <p className="whitespace-pre-wrap text-sm text-ink-secondary">{item.body}</p>
        <p className="text-xs text-ink-tertiary">{formatTimestamp(item.timestamp)}</p>
      </div>
    </li>
  );
}

/**
 * CRM.md §25 (Step 18, audit §3.7; AI drafting added Step 56) — a unified
 * WhatsApp + email timeline for one lead, a manual compose box for staff,
 * and an AI-assist action that drafts/improves/corrects the message before
 * it's sent. AI drafting never sends anything itself — it only fills the
 * Subject/Message fields for staff to review, edit, and then explicitly
 * hit Send (CRM.md §25: "never auto-send without staff action").
 */
export function CommunicationsPanel({ leadId }: { leadId: string }) {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<CommunicationsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<ChannelFilter>("ALL");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [draftType, setDraftType] = useState<DraftType>("STATUS_UPDATE");
  const [instructions, setInstructions] = useState("");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<CommunicationsResponse>(`/api/leads/${leadId}/communications`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load communications. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshNonce]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || (channel === "EMAIL" && !subject.trim())) return;
    setSending(true);
    try {
      await patchJson(`/api/leads/${leadId}/communications/send`, channel === "EMAIL" ? { channel, subject, body } : { channel, body });
      toast.success(channel === "EMAIL" ? "Email sent." : "WhatsApp message sent.");
      setSubject("");
      setBody("");
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send that message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const result = await postJson<{ subject: string | null; body: string; provider: string }>(`/api/leads/${leadId}/communications/draft`, {
        channel,
        draftType,
        instructions: instructions.trim() || undefined,
        existingBody: body.trim() || undefined,
      });
      if (channel === "EMAIL") setSubject(result.subject ?? "");
      setBody(result.body);
      toast.success(result.provider === "claude" ? "Draft generated." : "Drafted from a basic template — AI drafting isn't configured yet.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate a draft. Please try again.");
    } finally {
      setDrafting(false);
    }
  };

  const items = data?.items.filter((item) => filter === "ALL" || item.channel === filter) ?? [];
  const whatsappDisabled = channel === "WHATSAPP" && data ? !data.whatsapp.windowOpen : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "EMAIL", "WHATSAPP"] as ChannelFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === option ? "bg-accent text-white" : "bg-ink-primary/[0.06] text-ink-secondary hover:bg-ink-primary/[0.1]"
            )}
          >
            {option === "ALL" ? "All" : option === "EMAIL" ? "Email" : "WhatsApp"}
          </button>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"} className="ml-auto">
          <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load communications"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setRefreshNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && items.length === 0 ? <p className="text-sm text-ink-tertiary">No communication recorded yet.</p> : null}

      {state === "success" && items.length > 0 ? <ol className="flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">{items.map((item) => <CommunicationRow key={`${item.channel}-${item.id}`} item={item} />)}</ol> : null}

      {state === "success" ? (
        <form onSubmit={handleSend} className="flex flex-col gap-3 border-t border-hairline pt-4">
          <div className="flex gap-2">
            <Button type="button" variant={channel === "EMAIL" ? "primary" : "ghost"} size="sm" onClick={() => setChannel("EMAIL")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </Button>
            <Button type="button" variant={channel === "WHATSAPP" ? "primary" : "ghost"} size="sm" onClick={() => setChannel("WHATSAPP")}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </Button>
          </div>

          {channel === "EMAIL" && !data?.customer.email ? <p className="text-xs text-error">This customer has no email on file — can&apos;t send an email.</p> : null}
          {whatsappDisabled ? (
            <p className="text-xs text-error">
              Outside the 24-hour WhatsApp session window — the customer needs to message in first before a freeform message can be delivered.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="commDraftType" className="sr-only">
                Draft type
              </label>
              <select
                id="commDraftType"
                value={draftType}
                onChange={(event) => setDraftType(event.target.value as DraftType)}
                disabled={drafting}
                className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[190px]")}
              >
                {DRAFT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label htmlFor="commInstructions" className="sr-only">
                Extra instructions for the draft (optional)
              </label>
              <input
                id="commInstructions"
                type="text"
                placeholder="Optional: extra instructions for the draft…"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                disabled={drafting}
                className={cn(fieldControlClass, fieldBorderClass(false), "h-9 min-w-[220px] flex-1")}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleDraft()}
                isLoading={drafting}
                disabled={drafting || (channel === "EMAIL" ? !data?.customer.email : whatsappDisabled)}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {body.trim() ? "Improve with AI" : "AI Draft"}
              </Button>
            </div>
            <p className="text-xs text-ink-tertiary">Drafts from this record&apos;s real data — review and edit before sending.</p>
          </div>

          {channel === "EMAIL" ? (
            <TextField label="Subject" name="commSubject" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={sending || drafting || !data?.customer.email} />
          ) : null}
          <Textarea
            label="Message"
            name="commBody"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={sending || drafting || (channel === "EMAIL" ? !data?.customer.email : whatsappDisabled)}
          />

          <Button
            type="submit"
            size="sm"
            isLoading={sending}
            disabled={sending || drafting || !body.trim() || (channel === "EMAIL" ? !subject.trim() || !data?.customer.email : whatsappDisabled)}
            className="self-end"
          >
            Send
          </Button>
        </form>
      ) : null}
    </div>
  );
}
