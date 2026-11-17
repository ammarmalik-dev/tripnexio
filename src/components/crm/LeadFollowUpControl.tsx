"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { patchJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/** Client doc 16 Nov (J1) — the lead's next follow-up date and note (shown in Follow-ups from that day). */
export function LeadFollowUpControl({
  leadId,
  nextFollowUpAt,
  followUpNote,
  onChanged,
}: {
  leadId: string;
  nextFollowUpAt: string | null;
  followUpNote: string | null;
  onChanged: (value: { nextFollowUpAt: string | null; followUpNote: string | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(nextFollowUpAt ? nextFollowUpAt.slice(0, 10) : "");
  const [note, setNote] = useState(followUpNote ?? "");
  const [saving, setSaving] = useState(false);
  const control = cn(fieldControlClass, fieldBorderClass(false), "h-8 text-xs");

  const save = async (clear = false) => {
    setSaving(true);
    try {
      const result = await patchJson<{ nextFollowUpAt: string | null; followUpNote: string | null }>(`/api/leads/${leadId}/follow-up`, {
        date: clear ? null : date || null,
        note: note.trim() || undefined,
      });
      toast.success(clear || !date ? "Follow-up cleared." : "Follow-up set.");
      onChanged(result);
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the follow-up.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-accent hover:underline">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        {nextFollowUpAt
          ? `Follow-up ${new Date(nextFollowUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}${followUpNote ? ` · ${followUpNote}` : ""}`
          : "Set follow-up"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" aria-label="Follow-up date" value={date} onChange={(event) => setDate(event.target.value)} className={control} />
      <input aria-label="Follow-up note" placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} className={cn(control, "w-48")} />
      <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!date}>
        Save
      </Button>
      {nextFollowUpAt ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => void save(true)} disabled={saving}>
          Clear
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}
