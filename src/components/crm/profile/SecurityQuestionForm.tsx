"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { patchJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  securityQuestionSchema,
  STAFF_SECURITY_QUESTIONS,
  type SecurityQuestionValues,
} from "@/lib/validation/staff-profile-schema";

/**
 * P22 item 5 — CRM.md §31 Security Question. Only the chosen question is
 * ever shown back; the answer is write-only (hashed server-side).
 */
export function SecurityQuestionForm({ currentQuestion }: { currentQuestion: string | null }) {
  const [savedQuestion, setSavedQuestion] = useState<string | null>(currentQuestion);
  const emptyValues: SecurityQuestionValues = { question: savedQuestion ?? "", answer: "", password: "" };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SecurityQuestionValues>({
    resolver: zodResolver(securityQuestionSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await patchJson<{ securityQuestion: string }>("/api/crm/profile/security-question", values);
      setSavedQuestion(result.securityQuestion);
      toast.success(savedQuestion ? "Security question updated." : "Security question saved.");
      reset({ question: result.securityQuestion, answer: "", password: "" });
    } catch (error) {
      const currentPasswordError = error instanceof ApiError ? error.fieldErrors?.password?.[0] : undefined;
      if (currentPasswordError) setError("password", { message: currentPasswordError });
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your security question. Please try again.");
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {savedQuestion ? (
        <p className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-2 p-3 text-sm text-ink-secondary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-accent" aria-hidden="true" />
          <span>
            Set: <span className="font-medium text-ink-primary">{savedQuestion}</span>. Submit the form again to change it.
          </span>
        </p>
      ) : (
        <p className="text-sm text-ink-tertiary">No security question set yet.</p>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Question" htmlFor="security-question" error={errors.question?.message} required>
          <select id="security-question" className={cn(fieldControlClass, fieldBorderClass(!!errors.question))} {...register("question")}>
            <option value="" disabled>
              Select a question
            </option>
            {STAFF_SECURITY_QUESTIONS.map((question) => (
              <option key={question} value={question}>
                {question}
              </option>
            ))}
          </select>
        </FormField>
        <TextField
          label="Answer"
          required
          autoComplete="off"
          hint="Not case-sensitive. Stored securely — nobody, including admins, can read it back."
          error={errors.answer?.message}
          {...register("answer")}
        />
        <PasswordField
          label="Current Password"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <div>
          <Button type="submit" size="sm" isLoading={isSubmitting}>
            {savedQuestion ? "Update security question" : "Save security question"}
          </Button>
        </div>
      </form>
    </div>
  );
}
