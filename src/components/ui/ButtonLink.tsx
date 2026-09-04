"use client";

import { forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { buttonBaseClass, buttonVariantClass, buttonSizeClass } from "./Button";

const MotionLink = motion.create(Link);

type ButtonVariant = keyof typeof buttonVariantClass;
type ButtonSize = keyof typeof buttonSizeClass;

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <MotionLink
        ref={ref}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
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
      </MotionLink>
    );
  }
);

ButtonLink.displayName = "ButtonLink";
