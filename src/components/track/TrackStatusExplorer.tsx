"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Search, SearchX, MessageCircleQuestion } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Button, buttonBaseClass, buttonVariantClass, buttonSizeClass } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusTimeline } from "./StatusTimeline";
import { trackRequest, SAMPLE_TRACKING_IDS, type TrackResult } from "@/lib/mock-api/track";
import { trackSchema, type TrackValues } from "@/lib/validation/track-schema";
import { siteConfig } from "@/lib/site-config";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

type SearchState = "idle" | "loading" | "found" | "not-found" | "error";

interface TrackStatusExplorerProps {
  initialReferenceId?: string;
}

export function TrackStatusExplorer({ initialReferenceId }: TrackStatusExplorerProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TrackValues>({
    resolver: zodResolver(trackSchema),
    defaultValues: { referenceId: initialReferenceId ?? "" },
  });
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<TrackResult | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const runSearch = handleSubmit(async (values) => {
    setState("loading");
    try {
      const found = await trackRequest(values.referenceId);
      if (found) {
        setResult(found);
        setState("found");
      } else {
        setResult(null);
        setState("not-found");
      }
    } catch {
      // Not reachable from this deterministic mock today — kept so the UI
      // has a real error branch ready once a real lookup API exists (M2).
      setResult(null);
      setState("error");
      toast.error("Couldn't check that request right now. Please try again.");
    }
  });

  const fillSample = (id: string) => {
    setValue("referenceId", id);
    void runSearch();
  };

  return (
    <div className="flex flex-col gap-8">
      <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
        <form onSubmit={runSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Booking / Reference ID"
              placeholder="e.g. NV-100234"
              required
              error={errors.referenceId?.message}
              {...register("referenceId")}
            />
          </div>
          <Button type="submit" size="lg" isLoading={state === "loading"} className="sm:mb-0">
            <Search className="h-4 w-4" aria-hidden="true" />
            Track
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
          <span>Try a sample ID:</span>
          {SAMPLE_TRACKING_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => fillSample(id)}
              className="rounded-pill border border-hairline px-2.5 py-1 font-medium text-ink-secondary transition-colors duration-200 hover:border-accent hover:text-ink-accent"
            >
              {id}
            </button>
          ))}
        </div>
      </GlassCard>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {state === "idle" ? (
            <EmptyState
              icon={<Search className="h-5 w-5" aria-hidden="true" />}
              title="Enter a reference ID to see your status"
              description="You'll find this ID in the confirmation we sent when you submitted a request."
            />
          ) : null}

          {state === "loading" ? (
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </GlassCard>
          ) : null}

          {state === "not-found" ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
              title="We couldn't find that request"
              description="Double-check the reference ID, or reach out and our team will look into it."
              action={
                <a
                  href={siteConfig.contact.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonBaseClass, buttonVariantClass.glass, buttonSizeClass.sm)}
                >
                  <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
                  Ask on WhatsApp
                </a>
              }
            />
          ) : null}

          {state === "error" ? (
            <ErrorState
              title="Couldn't check that request"
              description="Something went wrong on our end. Please try again."
              action={
                <Button type="button" size="sm" onClick={() => void runSearch()}>
                  Try again
                </Button>
              }
            />
          ) : null}

          {state === "found" && result ? (
            <div className="surface-dark-block flex flex-col gap-8 rounded-xl p-6 sm:p-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium tracking-wide text-ink-on-dark-tertiary uppercase">
                    {result.service} · {result.referenceId}
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-2xl">
                    {result.applicantName}
                  </h2>
                  <p className="text-sm text-ink-on-dark-secondary">Submitted {result.submittedDate}</p>
                </div>
              </div>
              <StatusTimeline stages={result.stages} />
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
