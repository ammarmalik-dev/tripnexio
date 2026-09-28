"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

/** Confirm-first (not stop-on-open), so link scanners that prefetch the URL can't opt a customer out. */
export function StopFollowUpsPanel({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const stop = async () => {
    setState("loading");
    try {
      await postJson("/api/follow-ups/stop", { token });
      setState("done");
      toast.success("Reminders stopped.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-5 text-sm text-ink-secondary">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <p>You won&apos;t get any more follow-up reminders about this request. Your request itself is unchanged.</p>
      </div>
    );
  }

  if (state === "error") {
    return <ErrorState title="Couldn't stop reminders" description={message} />;
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-6">
      <h1 className="text-xl font-semibold text-ink-heading">Stop follow-up reminders?</h1>
      <p className="text-sm text-ink-secondary">We&apos;ll stop sending periodic reminders about this request. You can still contact us any time.</p>
      <div>
        <Button type="button" onClick={() => void stop()} isLoading={state === "loading"}>
          Stop reminders
        </Button>
      </div>
    </div>
  );
}
