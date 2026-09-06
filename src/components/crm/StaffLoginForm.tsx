"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { staffLoginSchema, type StaffLoginValues } from "@/lib/validation/staff-login-schema";

interface StaffLoginFormProps {
  redirectTo?: string;
}

function safeRedirectTarget(path: string | undefined): string {
  return path && path.startsWith("/crm") ? path : "/crm/leads";
}

export function StaffLoginForm({ redirectTo }: StaffLoginFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginValues>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postJson("/api/crm/auth/login", values);
      toast.success("Signed in");
      router.push(safeRedirectTarget(redirectTo));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't sign in. Please try again.");
    }
  });

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
      <PasswordField
        label="Password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Sign In
      </Button>
    </form>
  );
}
