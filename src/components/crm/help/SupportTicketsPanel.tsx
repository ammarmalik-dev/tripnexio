"use client";

import { useEffect, useState } from "react";
import { Inbox, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Textarea } from "@/components/forms/Textarea";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { PocFilterSelect } from "@/components/crm/PocFilterSelect";
import { toast } from "@/components/ui/Toaster";
import { ApiError, getJson, patchJson, postJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
const STATUS_LABELS: Record<TicketStatus, string> = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };
const STATUS_STYLE: Record<TicketStatus, string> = { OPEN: "bg-warning/10 text-warning", IN_PROGRESS: "bg-accent/10 text-ink-accent", RESOLVED: "bg-success/10 text-success" };

interface TicketRow {
  id: string;
  ticketNumber: string;
  title: string;
  priority: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  raisedBy: { name: string };
  assignedTo: { id: string; name: string } | null;
  _count: { comments: number; attachments: number };
}

interface TicketDetail extends Omit<TicketRow, "_count"> {
  description: string;
  pageUrl: string | null;
  resolutionNote: string | null;
  comments: { id: string; body: string; createdAt: string; author: { name: string } | null }[];
  attachments: { id: string; fileName: string; sizeBytes: number }[];
  history: { id: string; action: string; note: string | null; timestamp: string }[];
  canManage: boolean;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>{STATUS_LABELS[status]}</span>;
}

/** One ticket: description, files, comments (add one), history; managers also assign / change the status. */
function TicketDetailView({ ticketId, onChanged }: { ticketId: string; onChanged: () => void }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [nonce, setNonce] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<TicketStatus>("OPEN");
  const [resolution, setResolution] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<TicketDetail>(`/api/crm/support-tickets/${ticketId}`);
        if (cancelled) return;
        setTicket(result);
        setStatus(result.status);
        setResolution(result.resolutionNote ?? "");
        setAssignee(result.assignedTo?.id ?? "");
        setState("success");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticketId, nonce]);

  const refresh = () => {
    setNonce((n) => n + 1);
    onChanged();
  };

  const addComment = async () => {
    setBusy(true);
    try {
      await postJson(`/api/crm/support-tickets/${ticketId}/comments`, { body: comment });
      setComment("");
      toast.success("Comment added.");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add the comment.");
    } finally {
      setBusy(false);
    }
  };

  const saveManager = async () => {
    setBusy(true);
    try {
      const result = await patchJson<{ changed: boolean }>(`/api/crm/support-tickets/${ticketId}`, {
        assignedToId: assignee === "" || assignee === "unassigned" ? null : assignee,
        status,
        ...(status === "RESOLVED" ? { resolutionNote: resolution } : {}),
      });
      toast.success(result.changed ? "Ticket updated." : "Nothing changed.");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the ticket.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <Skeleton className="h-40 w-full" />;
  if (state === "error" || !ticket) return <ErrorState title="Couldn't load the ticket" description="Try again in a moment." />;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-2 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink-heading">
          {ticket.ticketNumber} · {ticket.title}
        </span>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="whitespace-pre-line text-ink-secondary">{ticket.description}</p>
      {ticket.pageUrl ? <p className="text-xs text-ink-tertiary">Page: {ticket.pageUrl}</p> : null}
      {ticket.resolutionNote ? (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">
          <strong>Resolution:</strong> {ticket.resolutionNote}
        </p>
      ) : null}
      {ticket.attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {ticket.attachments.map((file) => (
            <li key={file.id}>
              <a
                href={`/api/crm/support-tickets/${ticket.id}/attachments/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-ink-primary/5 px-2.5 py-1 text-xs text-ink-accent hover:underline"
              >
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {file.fileName}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {ticket.canManage ? (
        <div className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-1 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-tertiary">Assigned to</span>
              <PocFilterSelect id={`ticket-assignee-${ticket.id}`} value={assignee} onChange={setAssignee} allLabel="Nobody yet" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`ticket-status-${ticket.id}`} className="text-xs text-ink-tertiary">
                Status
              </label>
              <select
                id={`ticket-status-${ticket.id}`}
                value={status}
                onChange={(event) => setStatus(event.target.value as TicketStatus)}
                className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto text-sm")}
              >
                {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" size="sm" onClick={() => void saveManager()} isLoading={busy}>
              Save
            </Button>
          </div>
          {status === "RESOLVED" && ticket.status !== "RESOLVED" ? (
            <Textarea name={`ticket-resolution-${ticket.id}`} label="Resolution note" required rows={2} value={resolution} onChange={(event) => setResolution(event.target.value)} />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-ink-tertiary uppercase">Comments</span>
        {ticket.comments.length === 0 ? <p className="text-xs text-ink-tertiary">No comments yet.</p> : null}
        {ticket.comments.map((entry) => (
          <div key={entry.id} className="rounded-md bg-surface-1 px-3 py-2">
            <span className="block text-xs text-ink-tertiary">
              {entry.author?.name ?? "—"} · {when(entry.createdAt)}
            </span>
            <span className="whitespace-pre-line text-ink-primary">{entry.body}</span>
          </div>
        ))}
        <Textarea name={`ticket-comment-${ticket.id}`} label="Add a comment" rows={2} value={comment} onChange={(event) => setComment(event.target.value)} />
        <div>
          <Button type="button" size="sm" variant="ghost" onClick={() => void addComment()} disabled={comment.trim().length < 2} isLoading={busy}>
            Post comment
          </Button>
        </div>
      </div>

      <details className="text-xs text-ink-tertiary">
        <summary className="cursor-pointer font-medium">History ({ticket.history.length})</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {ticket.history.map((row) => (
            <li key={row.id}>
              {when(row.timestamp)} — {row.note ?? row.action}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * Client doc 16 Nov (L3) — help desk tickets: `mine` on the CRM Help page (the staff member's own), `all` in
 * Admin → Support Tickets (filters + manager controls). Click a ticket to open it below its row.
 */
export function SupportTicketsPanel({ scope, reloadKey = 0, initialTicketId = null }: { scope: "mine" | "all"; reloadKey?: number; initialTicketId?: string | null }) {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [nonce, setNonce] = useState(0);
  const [openId, setOpenId] = useState<string | null>(initialTicketId);
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const params = new URLSearchParams({ scope });
        if (status) params.set("status", status);
        if (assignedTo) params.set("assignedTo", assignedTo);
        if (search.trim()) params.set("search", search.trim());
        const result = await getJson<TicketRow[]>(`/api/crm/support-tickets?${params.toString()}`);
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [scope, status, assignedTo, search, nonce, reloadKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`tickets-search-${scope}`} className="sr-only">
          Search tickets
        </label>
        <input
          id={`tickets-search-${scope}`}
          type="search"
          placeholder="Ticket ID or title"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-48 text-sm")}
        />
        <label htmlFor={`tickets-status-${scope}`} className="sr-only">
          Filter by status
        </label>
        <select
          id={`tickets-status-${scope}`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto text-sm")}
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        {scope === "all" ? <PocFilterSelect id="tickets-assignee" value={assignedTo} onChange={setAssignedTo} allLabel="Any assignee" /> : null}
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load the tickets"
          description="Try again in a moment."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={() => setNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-5 w-5" aria-hidden="true" />} title="No tickets" description={scope === "mine" ? "Issues you report appear here with their status." : "Tickets staff raise appear here."} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpenId((current) => (current === row.id ? null : row.id))}
                aria-expanded={openId === row.id}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-left text-sm hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="font-semibold text-ink-accent">{row.ticketNumber}</span> <span className="text-ink-primary">{row.title}</span>
                  <span className="block text-xs text-ink-tertiary">
                    {scope === "all" ? `${row.raisedBy.name} · ` : ""}
                    {when(row.createdAt)} · {row.assignedTo ? `Assigned to ${row.assignedTo.name}` : "Not assigned yet"}
                    {row._count.comments ? ` · ${row._count.comments} comment${row._count.comments === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <StatusBadge status={row.status} />
              </button>
              {openId === row.id ? <TicketDetailView ticketId={row.id} onChanged={() => setNonce((n) => n + 1)} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
