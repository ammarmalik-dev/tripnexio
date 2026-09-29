"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Loader2, Volume2, VolumeX } from "lucide-react";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { StaffNotificationFeed, StaffNotificationItem } from "@/lib/validation/staff-notification-schema";

const POLL_INTERVAL_MS = 60_000;

function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const withWebkit = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

/** A short two-note chime generated with the Web Audio API — no audio file needed. */
function playChime(context: AudioContext) {
  const start = context.currentTime;
  [880, 1175].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const noteStart = start + index * 0.14;
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.25);
  });
}

/**
 * P22 — CRM.md §4/§26/§33: the staff notifications feed in the CRM/Admin
 * topbar. Deliberately a labelled text button ("Notifications" + unread
 * count), not a bell icon (CRM.md §4/§33). Polls every 60 s; with the sound
 * preference on, a short chime plays when the unread count goes up.
 * Browsers block audio until the page has had a user interaction, so the
 * AudioContext is created/resumed on the first click of this menu or the
 * sound toggle; until then a chime is silently skipped.
 */
export function NotificationsMenu() {
  const router = useRouter();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastUnreadRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<StaffNotificationFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sound, setSound] = useState(false);
  const [savingSound, setSavingSound] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [now, setNow] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load + 60 s polling. The fetch function is declared inside the
  // effect (react-hooks/set-state-in-effect — see CLAUDE.md).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof document !== "undefined" && document.hidden && lastUnreadRef.current !== null) return;
      try {
        const data = await getJson<StaffNotificationFeed>("/api/crm/notifications");
        if (cancelled) return;
        const previous = lastUnreadRef.current;
        if (previous !== null && data.unreadCount > previous && data.sound) {
          const context = audioRef.current;
          if (context && context.state === "running") {
            try {
              playChime(context);
            } catch {
              // Audio is a nicety — never let it break the feed.
            }
          }
        }
        lastUnreadRef.current = data.unreadCount;
        setFeed(data);
        setSound(data.sound);
        setErrorMessage("");
        setNow(Date.now());
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load notifications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  /** Must run inside a user gesture — that's what lets the browser allow audio later. */
  function unlockAudio() {
    try {
      if (!audioRef.current) {
        const Constructor = getAudioContextConstructor();
        if (!Constructor) return;
        audioRef.current = new Constructor();
      }
      if (audioRef.current.state === "suspended") void audioRef.current.resume().catch(() => undefined);
    } catch {
      // Audio unavailable — the feed still works silently.
    }
  }

  const unreadCount = feed?.unreadCount ?? 0;
  const notifications = feed?.notifications ?? [];

  const applyRead = (ids: string[] | "all", newUnreadCount: number) => {
    const readAt = new Date().toISOString();
    lastUnreadRef.current = newUnreadCount;
    setFeed((current) =>
      current
        ? {
            ...current,
            unreadCount: newUnreadCount,
            notifications: current.notifications.map((item) =>
              !item.readAt && (ids === "all" || ids.includes(item.id)) ? { ...item, readAt } : item
            ),
          }
        : current
    );
  };

  const handleToggleOpen = () => {
    unlockAudio();
    setNow(Date.now());
    setOpen((value) => !value);
  };

  const handleItemClick = async (item: StaffNotificationItem) => {
    setOpen(false);
    if (!item.readAt) {
      try {
        const result = await postJson<{ updated: number; unreadCount: number }>("/api/crm/notifications/read", { ids: [item.id] });
        applyRead([item.id], result.unreadCount);
      } catch {
        // Navigation matters more than the read flag; the next poll catches up.
      }
    }
    if (item.link) router.push(item.link);
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      const result = await postJson<{ updated: number; unreadCount: number }>("/api/crm/notifications/read", { all: true });
      applyRead("all", result.unreadCount);
      toast.success("All notifications marked as read.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't mark notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleToggleSound = async () => {
    unlockAudio();
    const next = !sound;
    setSavingSound(true);
    setSound(next);
    try {
      await patchJson<{ sound: boolean }>("/api/crm/notifications/preferences", { sound: next });
      toast.success(next ? "Notification sound on." : "Notification sound off.");
    } catch (error) {
      setSound(!next);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your sound preference.");
    } finally {
      setSavingSound(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="flex h-9 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 text-sm font-medium text-ink-primary transition-colors duration-150 hover:bg-ink-primary/[0.05] focus-visible:ring-2 focus-visible:ring-ink-accent focus-visible:outline-none"
      >
        <Inbox className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 ? (
          <span className="min-w-5 rounded-full bg-ink-accent px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold text-white" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute top-full right-0 z-30 mt-2 flex max-h-[32rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-primary">Notifications</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleSound}
                disabled={savingSound}
                aria-pressed={sound}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink-primary/[0.05] focus-visible:ring-2 focus-visible:ring-ink-accent focus-visible:outline-none disabled:opacity-60"
              >
                {sound ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
                Sound {sound ? "on" : "off"}
              </button>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll || unreadCount === 0}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-accent transition-colors duration-150 hover:bg-ink-accent/10 focus-visible:ring-2 focus-visible:ring-ink-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent"
              >
                {markingAll ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" /> : null}
                Mark all as read
              </button>
            </div>
          </div>

          <div className="overflow-y-auto" aria-live="polite" aria-busy={loading}>
            {loading && !feed ? (
              <ul className="divide-y divide-hairline" aria-label="Loading notifications">
                {[0, 1, 2].map((index) => (
                  <li key={index} className="space-y-2 px-4 py-3">
                    <div className="h-3.5 w-2/3 rounded bg-ink-primary/[0.07] motion-safe:animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-ink-primary/[0.05] motion-safe:animate-pulse" />
                  </li>
                ))}
              </ul>
            ) : errorMessage && !feed ? (
              <div className="space-y-2 px-4 py-6 text-center">
                <p className="text-sm text-error">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setReloadKey((key) => key + 1);
                  }}
                  className="text-xs font-medium text-ink-accent hover:underline focus-visible:ring-2 focus-visible:ring-ink-accent focus-visible:outline-none"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Inbox className="mx-auto h-6 w-6 text-ink-muted" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink-primary">You&rsquo;re all caught up</p>
                <p className="mt-0.5 text-xs text-ink-tertiary">New leads, bookings, payments and alerts will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void handleItemClick(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-ink-primary/[0.04] focus-visible:bg-ink-primary/[0.04] focus-visible:outline-none",
                        !item.readAt && "bg-ink-accent/[0.04]"
                      )}
                    >
                      <span
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-ink-accent")}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm text-ink-primary", !item.readAt && "font-semibold")}>
                          {item.title}
                          {!item.readAt ? <span className="sr-only"> (unread)</span> : null}
                        </span>
                        {item.body ? <span className="mt-0.5 block text-xs text-ink-secondary">{item.body}</span> : null}
                        <span className="mt-1 block text-[11px] text-ink-tertiary">
                          <time dateTime={item.createdAt}>{timeAgo(item.createdAt, now)}</time>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errorMessage && feed ? <p className="border-t border-hairline px-4 py-2 text-xs text-error">{errorMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
