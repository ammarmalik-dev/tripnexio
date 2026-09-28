"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/reset-password-schema";

export function ResetPasswordForm({
  token,
  endpoint = "/api/crm/auth/reset-password",
  signInHref = "/crm/login",
}: {
  token: string;
  /** P09 — the customer /reset-password page reuses this form against its own endpoint. */
  endpoint?: string;
  signInHref?: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postJson(endpoint, values);
      toast.success("Password reset. Please sign in.");
      router.push(signInHref);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't reset your password. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <PasswordField
        label="New Password"
        autoComplete="new-password"
        required
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <PasswordField
        label="Confirm New Password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Reset Password
      </Button>
    </form>
  );
}
