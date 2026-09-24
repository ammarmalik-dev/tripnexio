"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { Button } from "@/components/ui/Button";
import { StaffGoogleButton } from "@/components/auth/StaffGoogleButton";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { staffLoginFormSchema, type StaffLoginFormValues } from "@/lib/validation/staff-login-schema";

interface StaffLoginFormProps {
  redirectTo?: string;
}

function safeRedirectTarget(path: string | undefined): string {
  return path && path.startsWith("/crm") ? path : "/crm/leads";
}

/**
 * Step 48 (Internal Dashboard Merged §1). The Admin/Team Member selector
 * is purely presentational — every staff account authenticates through
 * the exact same POST /api/crm/auth/login regardless of which card is
 * selected (confirmed during research: `User` has no field distinguishing
 * an "Admin door" from a "Team Member door," just a single role → RBAC
 * permission set evaluated AFTER login). It only changes the caption
 * shown above the form and is stripped from the request body before
 * sending — never validated or trusted server-side.
 *
 * The "Team Member" caption below is the client's own suggested wording
 * verbatim; the "Admin" caption has no equivalent in the spec (only an
 * "employee caption" was given) — a reasonable parallel line, not a
 * locked requirement.
 */
const LOGIN_TYPE_CAPTIONS: Record<StaffLoginFormValues["loginType"], string> = {
  admin: "Sign in to manage your organization.",
  team_member: "Welcome back! Let's make every journey seamless.",
};

export function StaffLoginForm({ redirectTo }: StaffLoginFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginFormValues>({
    resolver: zodResolver(staffLoginFormSchema),
    defaultValues: { email: "", password: "", loginType: "team_member" },
  });
  const loginType = watch("loginType");

  const onSubmit = handleSubmit(async ({ loginType: _loginType, ...credentials }) => {
    try {
      await postJson("/api/crm/auth/login", credentials);
      toast.success("Signed in");
      router.push(safeRedirectTarget(redirectTo));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't sign in. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <RadioCardGroup<StaffLoginFormValues>
        name="loginType"
        label="Login as"
        register={register}
        selectedValue={loginType}
        options={[
          { value: "admin", label: "Admin Login" },
          { value: "team_member", label: "Team Member Login" },
        ]}
      />
      <p className="text-sm text-ink-secondary">{LOGIN_TYPE_CAPTIONS[loginType]}</p>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        label="Password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="flex justify-end">
        <Link href="/crm/forgot-password" className="text-sm font-medium text-ink-accent hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Sign In
      </Button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-xs text-ink-tertiary">or</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <StaffGoogleButton />
    </form>
  );
}
