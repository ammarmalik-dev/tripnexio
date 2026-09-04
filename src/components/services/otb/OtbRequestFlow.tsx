"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Stepper } from "@/components/forms/Stepper";
import { useMultiStepForm } from "@/components/forms/useMultiStepForm";
import { Step1BasicDetails } from "./steps/Step1BasicDetails";
import { Step2ProcessingType } from "./steps/Step2ProcessingType";
import { Step3Summary } from "./steps/Step3Summary";
import { OtbSuccessPanel } from "./OtbSuccessPanel";
import { submitOtbRequest } from "@/lib/mock-api/otb";
import {
  otbRequestSchema,
  otbStepFields,
  otbStepLabels,
  type OtbRequestValues,
} from "@/lib/validation/otb-schema";

type SubmitState = "idle" | "loading" | "success" | "error";

const stepComponents = [Step1BasicDetails, Step2ProcessingType, Step3Summary];

export function OtbRequestFlow() {
  const methods = useForm<OtbRequestValues>({
    resolver: zodResolver(otbRequestSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      mobile: "",
      email: "",
      airline: "",
      travelDate: "",
      processingType: undefined,
    },
  });
  const { currentIndex, isFirstStep, isLastStep, goNext, goBack } = useMultiStepForm(stepComponents.length);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleNext = async () => {
    const valid = await methods.trigger(otbStepFields[currentIndex]);
    if (valid) goNext();
  };

  const onSubmit = methods.handleSubmit(async (values) => {
    setSubmitState("loading");
    try {
      const result = await submitOtbRequest(values);
      setReferenceId(result.referenceId);
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  });

  if (submitState === "success" && referenceId) {
    return (
      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-xl">
          <OtbSuccessPanel referenceId={referenceId} />
        </div>
      </Container>
    );
  }

  const CurrentStep = stepComponents[currentIndex];
  const direction = shouldReduceMotion ? 0 : 1;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto flex max-w-xl flex-col gap-10">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-sm font-medium tracking-wide text-ink-accent">OTB Request</span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-heading sm:text-3xl">
            Request Ok to Board
          </h1>
        </div>

        <Stepper steps={otbStepLabels} currentIndex={currentIndex} />

        <FormProvider {...methods}>
          {/*
            All nav buttons below are type="button" — including the final
            "Submit Request" one, which calls `onSubmit` (already wrapped in
            methods.handleSubmit) directly from its onClick instead of
            relying on a native form submit. Toggling a button between
            type="button" and type="submit" based on state that changes as a
            *result* of clicking that same button races the browser's
            default action against React's re-render: the click can still
            end up submitting the form natively once the DOM node flips to
            type="submit", even though it was type="button" when clicked.
          */}
          <form onSubmit={onSubmit} className="flex flex-col gap-8">
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
                  <Button type="button" size="sm" onClick={onSubmit}>
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
                <Button type="button" onClick={onSubmit} isLoading={submitState === "loading"}>
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
