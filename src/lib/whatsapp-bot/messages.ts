import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { STATIC_SITE_CONTACT, type SiteContact } from "@/lib/site-contact";
import type { ServiceType } from "../../generated/prisma/enums";
import { requestReceivedMessage } from "../leads/request-received-message";

/**
 * Contact details quoted in bot replies. The engine refreshes this from
 * Admin → System Configuration (getSiteContact) at the start of every
 * inbound message; the value is the same for every conversation.
 */
let contact: SiteContact = STATIC_SITE_CONTACT;

export function setContactDetails(next: SiteContact): void {
  contact = next;
}

const MENU_LINES = [
  "1. New Visa",
  "2. Visa Extension",
  "3. Visa Change",
  "4. Flight Special Fare",
  "5. Return Verified Ticket",
  "6. OTB (Ok to Board)",
];

export function welcomeMenu(profileName?: string | null): string {
  const greeting = profileName ? `Hi ${profileName}! ` : "Hi! ";
  return (
    `${greeting}Welcome to TripNexio 👋\n\n` +
    `Tell me what you need in your own words (e.g. "I need a new visa" or "mera visa extend karna hai"), or just ask a question — I'm happy to help with:\n\n` +
    `${MENU_LINES.join("\n")}\n\n` +
    `You can also type "agent" anytime to talk to our team.`
  );
}

export function startingService(serviceType: ServiceType, firstFieldPrompt: string): string {
  return `Great — let's get your ${SERVICE_TYPE_LABELS[serviceType]} request started. I'll ask a few quick questions.\n\n${firstFieldPrompt}`;
}

/** Client testing 2026-10-09 (C8) — the same per-service "request received" text as the website and email. */
export function leadCreated(referenceId: string, serviceType: ServiceType): string {
  return (
    `${requestReceivedMessage(serviceType)}\n\nYour reference: *${referenceId}*.\n\n` +
    `You can also reach us anytime at ${contact.phone} or ${contact.email}.\n\n` +
    `Type "menu" if you'd like to start another request.`
  );
}

export function leadCreatedWithPayLink(referenceId: string, serviceLabel: string, payUrl: string): string {
  return (
    `All set! Your ${serviceLabel} booking is created — Booking ID *${referenceId}*.\n\n` +
    `Complete your payment securely here:\n${payUrl}\n\n` +
    `After payment you can upload the required documents on the same page. Type "status" anytime to check progress.`
  );
}

export function handoff(reason: string): string {
  return (
    `${reason} Let me connect you with our support team — ` +
    `they'll reply right here in this chat shortly. You can also reach us at:\n` +
    `📞 ${contact.phone}\n✉️ ${contact.email}`
  );
}

export function stillHandedOff(): string {
  return `Our team has this — they'll reach out shortly. Need anything else in the meantime? Type "menu" to start over.`;
}

export function faqFooter(): string {
  return `_Did that answer your question? Type "menu" to see what else I can help with, or "agent" to talk to our team._`;
}

export function invalidAnswer(error: string, retryPrompt: string): string {
  return `${error}\n\n${retryPrompt}`;
}

/** Visa_Extension.md §2/§25: no eligible TripNexio-issued visa found — routes to Visa Change (inside UAE) or New Visa (outside UAE) instead of creating an Extension lead. */
/** Client testing 2026-10-09 (B21) — no TripNexio visa found: the lead is created, then the visa copy is asked for. */
export function visaCopyRequest(name: string, redirectLabel: string): string {
  return (
    `We couldn't find a visa issued through TripNexio for these details, so our team will review your request.\n\n` +
    `Please send a clear photo or PDF of the current visa for *${name}* here.\n\n` +
    `(If you'd rather apply for *${redirectLabel}* instead, type "menu".)`
  );
}

export function visaCopyReminder(name: string): string {
  return `Please send a clear photo or PDF of the current visa for *${name}* here, or type "skip" and our team will contact you.`;
}

export function visaCopyNext(name: string): string {
  return `Thank you, received. Now please send the visa copy for *${name}*.`;
}

export function visaCopyUnreadable(name: string): string {
  return `Sorry, we couldn't read that file. Please send the visa copy for *${name}* as a JPG, PNG or PDF (8MB max).`;
}

export function visaCopyAllReceived(): string {
  return `Thank you, we have received the visa copy. Our team will review it and get in touch shortly.\n\nType "status" anytime to check progress.`;
}

export function visaCopySkipped(): string {
  return `No problem. Our team will contact you about the visa copy. Type "menu" anytime to start a new request.`;
}

export function attachmentNotExpected(): string {
  return `Thanks! We can only read attachments when we ask for a document. Please type your message, or type "menu" to see the options.`;
}

export function visaExtensionIneligible(redirectLabel: string): string {
  return (
    `We currently provide visa extension services only for visas issued through TripNexio, and we couldn't find a matching visa for these details.\n\n` +
    `It looks like *${redirectLabel}* may be the right service for you instead. Type "menu" to start that request, or "agent" to talk to our team.`
  );
}
