"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { TASK_PRIORITY_OPTIONS } from "@/lib/crm/labels";
import { supportRequestSchema, type SupportRequestValues } from "@/lib/validation/support-request-schema";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

const EMPTY_VALUES: SupportRequestValues = { title: "", description: "", pageUrl: "", priority: "NORMAL" };

/** P22 item 2 — "Report an issue" (CRM.md §28). Creates an unassigned SUPPORT_REQUEST task for admins. */
export function ReportIssueForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportRequestValues>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: EMPTY_VALUES,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postJson("/api/crm/support-requests", values);
      toast.success("Thanks — your report was sent to the admin team.");
      reset(EMPTY_VALUES);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send your report. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField label="Summary" required placeholder="e.g. Payment link button does nothing" error={errors.title?.message} {...register("title")} />
      <Textarea
        label="What happened?"
        required
        placeholder="What you were doing, what you expected, and what happened instead"
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Page / URL (optional)"
          placeholder="e.g. /crm/bookings/…"
          error={errors.pageUrl?.message}
          {...register("pageUrl")}
        />
        <FormField label="Priority" htmlFor="support-priority" error={errors.priority?.message} required>
          <select id="support-priority" className={cn(fieldControlClass, fieldBorderClass(!!errors.priority))} {...register("priority")}>
            {TASK_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div>
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Send report
        </Button>
      </div>
    </form>
  );
}
