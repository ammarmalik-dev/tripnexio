"use client";

import { useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormProvider, useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Stepper } from "./Stepper";
import { useMultiStepForm } from "./useMultiStepForm";
import { RequestSuccessPanel } from "./RequestSuccessPanel";
import { toast } from "@/components/ui/Toaster";
import { ApiError } from "@/lib/api/client";

type SubmitState = "idle" | "loading" | "success" | "error";

interface MultiStepRequestFlowProps<T extends FieldValues> {
  eyebrow: string;
  title: string;
  schema: ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  /** Fields to validate before advancing past each step index; the last step needs none. */
  stepFields: Record<number, (keyof T)[]>;
  stepLabels: string[];
  steps: ComponentType[];
  onSubmit: (values: T) => Promise<{ referenceId: string }>;
  successTitle: string;
  successDescription: string;
}

/**
 * Generic animated multi-step request flow — stepper, per-step zod
 * validation, loading/error/success states. Reused across every service
 * request UI (OTB, New Visa, Visa Extension, ...); only the step
 * components, schema, and copy differ per flow.
 */
export function MultiStepRequestFlow<T extends FieldValues>({
  eyebrow,
  title,
  schema,
  defaultValues,
  stepFields,
  stepLabels,
  steps,
  onSubmit,
  successTitle,
  successDescription,
}: MultiStepRequestFlowProps<T>) {
  const methods = useForm<T>({
    // zod's generic schema type and react-hook-form's Resolver type don't
    // unify cleanly through a passed-in generic T — safe because schema is
    // always the exact T-shaped schema each caller provides.
    resolver: zodResolver(schema as ZodType<FieldValues, FieldValues>) as unknown as Resolver<T>,
    mode: "onBlur",
    defaultValues,
  });
  const { currentIndex, isFirstStep, isLastStep, goNext, goBack } = useMultiStepForm(steps.length);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleNext = async () => {
    const valid = await methods.trigger(stepFields[currentIndex] as Path<T>[]);
    if (valid) goNext();
  };

  const submitHandler = methods.handleSubmit(async (values: T) => {
    setSubmitState("loading");
    try {
      const result = await onSubmit(values);
      setReferenceId(result.referenceId);
      setSubmitState("success");
      toast.success(successTitle, { description: `Reference ID: ${result.referenceId}` });
    } catch (error) {
      setSubmitState("error");
      toast.error(error instanceof ApiError ? error.message : "Couldn't submit your request. Please try again.");
    }
  });

  if (submitState === "success" && referenceId) {
    return (
      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-xl">
          <RequestSuccessPanel title={successTitle} description={successDescription} referenceId={referenceId} />
        </div>
      </Container>
    );
  }

  const CurrentStep = steps[currentIndex];
  const direction = shouldReduceMotion ? 0 : 1;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto flex max-w-xl flex-col gap-10">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-sm font-medium tracking-wide text-ink-accent">{eyebrow}</span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-heading sm:text-3xl">{title}</h1>
        </div>

        <Stepper steps={stepLabels} currentIndex={currentIndex} />

        <FormProvider {...methods}>
          {/*
            All nav buttons below are type="button" — including the final
            "Submit Request" one, which calls `submitHandler` (already
            wrapped in methods.handleSubmit) directly from its onClick
            instead of relying on a native form submit. Toggling a button
            between type="button" and type="submit" based on state that
            changes as a *result* of clicking that same button races the
            browser's default action against React's re-render: the click
            can still end up submitting the form natively once the DOM node
            flips to type="submit", even though it was type="button" when
            clicked.
          */}
          <form onSubmit={submitHandler} className="flex flex-col gap-8">
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentIndex}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 * direction }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: -16 * direction }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CurrentStep />
                </motion.div>
              </AnimatePresence>
            </div>

            {submitState === "error" ? (
              <ErrorState
                title="Couldn't submit your request"
                description="Something went wrong on our end. Please try again."
                action={
                  <Button type="button" size="sm" onClick={submitHandler}>
                    Try again
                  </Button>
                }
              />
            ) : null}

            <div className="flex items-center justify-between gap-3">
              {!isFirstStep ? (
                <Button type="button" variant="ghost" onClick={goBack} disabled={submitState === "loading"}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
              ) : (
                <span />
              )}

              {!isLastStep ? (
                <Button type="button" onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : submitState !== "error" ? (
                <Button type="button" onClick={submitHandler} isLoading={submitState === "loading"}>
                  Submit Request
                </Button>
              ) : null}
            </div>
          </form>
        </FormProvider>
      </div>
    </Container>
  );
}
