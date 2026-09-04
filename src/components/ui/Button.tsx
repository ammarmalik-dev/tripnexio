"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost" | "glass";
type ButtonSize = "sm" | "md" | "lg";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

export interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "text-white shadow-[0_8px_24px_-8px_rgb(62_111_219_/_55%)] bg-[image:var(--gradient-accent)] hover:brightness-110 focus-visible:outline-accent-light",
  ghost:
    "text-ink-primary border border-hairline hover:border-glass-border hover:bg-white/[0.03] focus-visible:outline-accent-light",
  glass:
    "glass-2 text-ink-primary hover:border-glass-border-strong focus-visible:outline-accent-light",
};

export const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-base gap-2",
};

export const buttonBaseClass =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, disabled, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={shouldReduceMotion || disabled ? undefined : { scale: 1.02 }}
        whileTap={shouldReduceMotion || disabled ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
        className={cn(
          buttonBaseClass,
          buttonVariantClass[variant],
          buttonSizeClass[size],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
