"use client";

import { useState } from "react";

export function useMultiStepForm(totalSteps: number) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const clamp = (index: number) => Math.min(Math.max(index, 0), totalSteps - 1);

  return {
    currentIndex,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === totalSteps - 1,
    goNext: () => setCurrentIndex((index) => clamp(index + 1)),
    goBack: () => setCurrentIndex((index) => clamp(index - 1)),
    goTo: (index: number) => setCurrentIndex(clamp(index)),
  };
}
