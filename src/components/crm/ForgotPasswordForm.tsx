"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/forgot-password-schema";

/**
 * The API always returns 200 with the same generic message whether or not
 * a matching account exists (see /api/crm/auth/forgot-password's own
 * comment) — so a successful submit always shows this confirmation
 * panel, never "email not found." A 429 (rate-limited) or a genuine
 * validation error is the only thing that keeps the form visible.
 */
export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postJson("/api/crm/auth/forgot-password", values);
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send the reset link. Please try again.");
    }
  });

  if (submitted) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-ink-secondary">
          If that email address belongs to a staff account, a password reset link has been sent. Check your inbox —
          the link expires in 30 minutes.
        </p>
        <Link href="/crm/login" className="text-sm font-medium text-ink-accent hover:underline">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />
      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Send Reset Link
      </Button>
      <Link href="/crm/login" className="text-center text-sm font-medium text-ink-accent hover:underline">
        Back to Sign In
      </Link>
    </form>
  );
}
