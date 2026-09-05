"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { AuthDivider } from "./AuthDivider";
import { GoogleButton } from "./GoogleButton";
import { GuestContinueLink } from "./GuestContinueLink";
import { AuthSuccessNotice } from "./AuthSuccessNotice";
import { registerUser } from "@/lib/mock-api/auth";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth-schema";

export function RegisterForm() {
  const [registered, setRegistered] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser(values);
      toast.success("Account created — this is a preview, so nothing was saved.");
      setRegistered(true);
    } catch {
      // Not reachable from this deterministic mock today — kept so the UI
      // has a real error branch ready once Auth.js is wired up (M2).
      toast.error("Couldn't create your account right now. Please try again.");
    }
  });

  if (registered) {
    return (
      <AuthSuccessNotice
        title="Account created (preview)"
        description="Auth isn't live yet — once M2 ships, this will sign you in automatically."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Full Name"
          autoComplete="name"
          required
          error={errors.fullName?.message}
          {...register("fullName")}
        />
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
          autoComplete="new-password"
          hint={!errors.password ? "At least 8 characters, with a number" : undefined}
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Create Account
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton />
      <GuestContinueLink />

      <p className="text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink-accent hover:underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
