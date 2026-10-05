"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { staffLoginFormSchema, type StaffLoginFormValues } from "@/lib/validation/staff-login-schema";

interface StaffLoginFormProps {
  redirectTo?: string;
}

function safeRedirectTarget(path: string | undefined): string {
  return path && path.startsWith("/crm") ? path : "/crm";
}

/**
 * Client corrections 2026-10-05: one login page with a Team Login /
 * Administrative Login selector. Both use POST /api/crm/auth/login; the
 * choice only decides where the user lands. Administrative Login opens the
 * Admin Panel when the account has Admin access (the response's
 * `adminAccess`, and /admin re-checks permissions on every request);
 * otherwise the user lands in the Internal Dashboard.
 */
const LOGIN_TYPES: Record<StaffLoginFormValues["loginType"], { label: string; caption: string; Icon: typeof Users }> = {
  team_member: { label: "Team Login", caption: "Sign in to manage daily operations.", Icon: Users },
  admin: { label: "Administrative Login", caption: "Sign in to manage organization.", Icon: Settings },
};

export function StaffLoginForm({ redirectTo, googleEnabled = false }: StaffLoginFormProps & { googleEnabled?: boolean }) {
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
  const selected = LOGIN_TYPES[loginType];

  const onSubmit = handleSubmit(async ({ loginType: chosen, ...credentials }) => {
    try {
      const result = await postJson<{ adminAccess: boolean }>("/api/crm/auth/login", credentials);
      if (chosen === "admin" && result.adminAccess) {
        toast.success("Signed in");
        router.push("/admin");
      } else if (chosen === "admin") {
        toast.error("This account doesn't have administrative access. Opening the Internal Dashboard.");
        router.push("/crm");
      } else {
        toast.success("Signed in");
        router.push(safeRedirectTarget(redirectTo));
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't sign in. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-heading">Login as</legend>
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-hairline bg-surface-1 p-1 sm:grid-cols-2">
          {(Object.keys(LOGIN_TYPES) as StaffLoginFormValues["loginType"][]).map((type) => {
            const { label, caption, Icon } = LOGIN_TYPES[type];
            const checked = loginType === type;
            return (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
                  checked ? "bg-[image:var(--gradient-accent)] text-white shadow-md" : "text-ink-primary hover:bg-ink-primary/[0.04]"
                )}
              >
                <input type="radio" value={type} className="sr-only" {...register("loginType")} />
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className={cn("text-xs", checked ? "text-white/85" : "text-ink-tertiary")}>{caption}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-0.5 pt-1">
        <h2 className="text-xl font-semibold text-ink-heading">{selected.label}</h2>
        <p className="text-sm text-ink-secondary">{selected.caption}</p>
      </div>
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
      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-ink-tertiary">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <GoogleButton href={`/api/auth/google/start?for=staff${redirectTo ? `&next=${encodeURIComponent(redirectTo)}` : ""}`} />
        </>
      ) : null}
    </form>
  );
}
