"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/validation/staff-profile-schema";

const EMPTY_VALUES: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

/** P22 item 5 — CRM.md §31 Change Password. The route re-issues this browser's session, so the user stays signed in. */
export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_VALUES,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postJson("/api/crm/profile/password", values);
      toast.success("Password changed. Other devices have been signed out.");
      reset(EMPTY_VALUES);
    } catch (error) {
      const currentPasswordError = error instanceof ApiError ? error.fieldErrors?.currentPassword?.[0] : undefined;
      if (currentPasswordError) setError("currentPassword", { message: currentPasswordError });
      toast.error(error instanceof ApiError ? error.message : "Couldn't change your password. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <PasswordField label="Current Password" autoComplete="current-password" required error={errors.currentPassword?.message} {...register("currentPassword")} />
      <PasswordField
        label="New Password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <PasswordField label="Confirm New Password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register("confirmPassword")} />
      <div>
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}
