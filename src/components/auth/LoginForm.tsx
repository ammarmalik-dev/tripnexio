"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { AuthDivider } from "./AuthDivider";
import { GoogleButton } from "./GoogleButton";
import { GuestContinueLink } from "./GuestContinueLink";
import { AuthSuccessNotice } from "./AuthSuccessNotice";
import { postJson, ApiError } from "@/lib/api/client";
import { loginSchema, type LoginValues } from "@/lib/validation/auth-schema";

export function LoginForm() {
  const router = useRouter();
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
      await postJson("/api/auth/login", values);
      toast.success("Signed in.");
      setSignedIn(true);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't sign you in right now. Please try again.");
    }
  });

  if (signedIn) {
    return (
      <AuthSuccessNotice
        title="Signed in"
        description="Welcome back — your requests and bookings are linked to your account."
        cta={{ label: "Go to My Account", href: "/account" }}
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
