"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowUp } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { ChatBubble } from "./ChatBubble";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/cn";
import { buttonBaseClass, buttonVariantClass, buttonSizeClass } from "@/components/ui/Button";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! I'm TripNexio AI — a preview for now, so I can't answer live yet. Tell me what you need and I'll point you to our support team.",
};

const CANNED_REPLY =
  "Thanks for the details! This preview can't process requests yet, but our support team can help right away.";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content };
}

interface AiChatShellProps {
  initialQuery?: string;
}

export function AiChatShell({ initialQuery }: AiChatShellProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialQuery ? [GREETING, createMessage("user", initialQuery)] : [GREETING]
  );
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(Boolean(initialQuery));
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const inputId = useId();

  useEffect(() => {
    if (!initialQuery) return;
    const timer = setTimeout(() => {
      setMessages((current) => [...current, createMessage("assistant", CANNED_REPLY)]);
      setIsTyping(false);
    }, 900);
    return () => clearTimeout(timer);
    // Only ever run for the initial query this component mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: shouldReduceMotion ? "auto" : "smooth" });
  }, [messages, isTyping, shouldReduceMotion]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isTyping) return;

    setMessages((current) => [...current, createMessage("user", trimmed)]);
    setDraft("");
    setIsTyping(true);

    setTimeout(() => {
      setMessages((current) => [...current, createMessage("assistant", CANNED_REPLY)]);
      setIsTyping(false);
    }, 900);
  };

  return (
    <GlassCard tier={2} className="flex h-[32rem] flex-col gap-0 overflow-hidden p-0 sm:h-[36rem]">
      <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-ink-heading">TripNexio AI</p>
          <p className="text-xs text-ink-tertiary">Preview — connects you to our support team</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <ChatBubble role={message.role}>
                  <p>{message.content}</p>
                  {message.id === "greeting" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={siteConfig.contact.whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonBaseClass, buttonVariantClass.glass, buttonSizeClass.sm, "!text-xs")}
                      >
                        WhatsApp Support
                      </a>
                      <Link
                        href="/services"
                        className={cn(buttonBaseClass, buttonVariantClass.ghost, buttonSizeClass.sm, "!text-xs")}
                      >
                        Browse Services
                      </Link>
                    </div>
                  ) : null}
                </ChatBubble>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping ? (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ChatBubble role="assistant">
                <span className="flex items-center gap-1" role="status" aria-label="TripNexio AI is typing">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-tertiary [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-tertiary [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-tertiary" />
                </span>
              </ChatBubble>
            </motion.div>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-hairline p-3">
        <label htmlFor={inputId} className="sr-only">
          Message TripNexio AI
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about a visa, flight, or your request…"
          className="h-11 flex-1 min-w-0 rounded-md bg-transparent px-3 text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isTyping}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_24px_-8px_rgb(62_111_219_/_55%)] bg-[image:var(--gradient-accent)] transition-transform duration-150 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </GlassCard>
  );
}
