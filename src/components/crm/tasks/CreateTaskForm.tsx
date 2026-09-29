"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListPlus, X } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { DateField } from "@/components/forms/DateField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { TASK_PRIORITY_OPTIONS } from "@/lib/crm/labels";
import { createManualTaskSchema, type CreateManualTaskValues } from "@/lib/validation/manual-task-schema";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface StaffOption {
  id: string;
  name: string;
}

type StaffLoadState = "loading" | "success" | "error";

export interface CreateTaskFormProps {
  /** Links the task to this lead (Lead detail). */
  leadId?: string;
  /** Links the task to this booking (Booking detail) — its lead/service are derived server-side. */
  bookingId?: string;
  onCreated?: () => void;
  onCancel?: () => void;
  /** Tighter single-column layout for a detail-page sidebar. */
  compact?: boolean;
}

/**
 * P22 item 4 — reusable manual-task form (Tasks page, Lead detail, Booking
 * detail). Posts to `POST /api/tasks`, which requires `tasks.edit` and
 * derives the task's entity/service from `leadId`/`bookingId` itself.
 */
export function CreateTaskForm({ leadId, bookingId, onCreated, onCancel, compact = false }: CreateTaskFormProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffState, setStaffState] = useState<StaffLoadState>("loading");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateManualTaskValues>({
    resolver: zodResolver(createManualTaskSchema),
    defaultValues: { title: "", reason: "", priority: "NORMAL", dueDate: "", assignedToId: "", leadId, bookingId },
  });

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      try {
        const result = await getJson<StaffOption[]>("/api/staff");
        if (cancelled) return;
        setStaff(result);
        setStaffState("success");
      } catch {
        if (!cancelled) setStaffState("error");
      }
    }
    void loadStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postJson("/api/tasks", { ...values, leadId, bookingId });
      toast.success("Task created.");
      reset({ title: "", reason: "", priority: "NORMAL", dueDate: "", assignedToId: "", leadId, bookingId });
      onCreated?.();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field in values && messages[0]) {
            setError(field as keyof CreateManualTaskValues, { message: messages[0] });
          }
        }
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the task. Please try again.");
    }
  });

  const idPrefix = bookingId ? "booking-task" : leadId ? "lead-task" : "task";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className={cn("grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <TextField
          label="Title"
          required
          placeholder="e.g. Call customer about passport copy"
          error={errors.title?.message}
          className={compact ? "h-10" : undefined}
          {...register("title")}
        />

        <FormField label="Priority" htmlFor={`${idPrefix}-priority`} error={errors.priority?.message} required>
          <select
            id={`${idPrefix}-priority`}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.priority), compact && "h-10")}
            {...register("priority")}
          >
            {TASK_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Assign to"
          htmlFor={`${idPrefix}-assignee`}
          error={errors.assignedToId?.message}
          hint={staffState === "error" ? "Couldn't load staff — the task will be created unassigned." : undefined}
        >
          <select
            id={`${idPrefix}-assignee`}
            disabled={staffState === "loading"}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.assignedToId), compact && "h-10")}
            {...register("assignedToId")}
          >
            <option value="">{staffState === "loading" ? "Loading staff…" : "Unassigned"}</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </FormField>

        <DateField label="Due date" error={errors.dueDate?.message} className={compact ? "h-10" : undefined} {...register("dueDate")} />
      </div>

      <Textarea label="Details" rows={compact ? 3 : 4} placeholder="Optional context for whoever picks this up" error={errors.reason?.message} {...register("reason")} />

      {errors.bookingId?.message ? <p className="text-xs font-medium text-error">{errors.bookingId.message}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Create task
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Compact "Add task" mount point for Lead/Booking detail — a sidebar card
 * with a toggle, so the detail pages only gain one line each.
 */
export function AddTaskPanel({ leadId, bookingId }: { leadId?: string; bookingId?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Tasks</h2>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? <X className="h-4 w-4" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
          {open ? "Close" : "Add task"}
        </Button>
      </div>
      {open ? (
        <div className="mt-4">
          <CreateTaskForm leadId={leadId} bookingId={bookingId} compact onCreated={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-tertiary">
          Create a follow-up for yourself or a teammate — it appears on the Tasks screen.
        </p>
      )}
    </section>
  );
}
