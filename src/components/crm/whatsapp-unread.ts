"use client";

import { useEffect, useState } from "react";

/** Client doc 16 Nov (L1) — the notifications poller announces the unread WhatsApp chat alerts on this window event. */
export const WHATSAPP_UNREAD_EVENT = "tn:whatsapp-unread";

/** The current unread WhatsApp chat count (0 until the first poll). */
export function useWhatsAppUnread(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onCount = (event: Event) => setCount(Number((event as CustomEvent<number>).detail) || 0);
    window.addEventListener(WHATSAPP_UNREAD_EVENT, onCount);
    return () => window.removeEventListener(WHATSAPP_UNREAD_EVENT, onCount);
  }, []);
  return count;
}
