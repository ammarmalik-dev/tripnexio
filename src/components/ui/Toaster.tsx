"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="top-right"
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "glass-2 !rounded-lg !text-ink-primary !border-glass-border",
          title: "!text-ink-primary !font-medium",
          description: "!text-ink-secondary",
          actionButton: "!bg-accent !text-white",
          cancelButton: "!bg-white/10 !text-ink-secondary",
          closeButton: "!bg-white/10 !text-ink-secondary !border-hairline",
          success: "!border-success/30",
          error: "!border-error/30",
          warning: "!border-warning/30",
        },
      }}
    />
  );
}

export { toast } from "sonner";
