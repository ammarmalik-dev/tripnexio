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
import { loginUser } from "@/lib/mock-api/auth";
import { loginSchema, type LoginValues } from "@/lib/validation/auth-schema";

export function LoginForm() {
  const [signedIn, setSignedIn] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await loginUser(values);
      toast.success("Signed in — this is a preview, so nothing was saved.");
      setSignedIn(true);
    } catch {
      // Not reachable from this deterministic mock today — kept so the UI
      // has a real error branch ready once Auth.js is wired up (M2).
      toast.error("Couldn't sign you in right now. Please try again.");
    }
  });

  if (signedIn) {
    return (
      <AuthSuccessNotice
        title="Signed in (preview)"
        description="Auth isn't live yet — once M2 ships, this will take you to your dashboard."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
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
          Log In
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton />
      <GuestContinueLink />

      <p className="text-center text-sm text-ink-secondary">
        Don&rsquo;t have an account?{" "}
        <Link href="/register" className="font-medium text-ink-accent hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
