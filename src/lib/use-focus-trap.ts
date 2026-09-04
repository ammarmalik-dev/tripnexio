"use client";

import { useCallback, type KeyboardEvent, type RefObject } from "react";

/**
 * Returns a keydown handler that traps Tab focus within `containerRef`
 * while `active` is true. Attach it to the container's onKeyDown.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  return useCallback(
    (event: KeyboardEvent) => {
      if (!active || event.key !== "Tab" || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [active, containerRef]
  );
}
