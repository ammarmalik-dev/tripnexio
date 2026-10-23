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

/** Client doc 2026-10-15 — the WhatsApp greeting, word for word (the tappable list in menu.ts uses it too). */
export const WELCOME_TEXT =
  "👋 Welcome to TripNexio!\n" +
  "How can we help you today? Choose a service below or type your request in your own words.\n" +
  "✈️ Visa & Travel Services\n" +
  "💬 Type Agent anytime to speak with our team.\n" +
  "👇 Tap See Options to get started.";

/** The plain-text greeting (message log / console gateway); the real message is the tappable list in menu.ts. */
export function welcomeMenu(profileName?: string | null): string {
  void profileName;
  return `${WELCOME_TEXT}\n${MENU_LINES.join("\n")}`;
}

/** Client doc 2026-10-15 — Visa Extension asked from outside the UAE: only New Visa applies. */
export function extensionOutsideUae(): string {
  return "Visa Extension is only for travellers who are currently inside the UAE. Since you're outside the UAE, you can apply for a New Visa instead — tap See Options below, or type \"agent\" for help.";
}

/** Client doc 2026-10-15 — no TripNexio visa for the given passport(s). */
export function tripNexioVisaNotFound(): string {
  return (
    "❌ *TripNexio Visa Not Found*\n\n" +
    "We couldn't find a visa issued through TripNexio for these passport details, so it can't be extended here. " +
    "You can apply for a Visa Change (if you're inside the UAE) or a New Visa instead — tap See Options below, or type \"agent\" for help."
  );
}

/**
 * Client doc 2026-10-15 — Visa Extension lead created: thank-you + link to upload the documents. Client 2026-10-23
 * audit — Visa Change too (the website asks the current visa copy before the quotation).
 */
export function extensionUploadRequest(referenceId: string, uploadUrl: string | null, serviceLabel = "Visa Extension"): string {
  return (
    `Thank you! Your ${serviceLabel} request has been received — reference *${referenceId}*.\n\n` +
    (uploadUrl
      ? "Please upload each passenger's passport and visa copies using the button below. "
      : "Our team will contact you for each passenger's passport and visa copies. ") +
    "Our team will validate the documents and share your quotation.\n\n" +
    'Type "status" anytime to check progress.' +
    (uploadUrl ? `\n${uploadUrl}` : "")
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

export function leadCreatedWithPayLink(referenceId: string, serviceLabel: string, payUrl: string, tripSummary = ""): string {
  return (
    `All set! Your ${serviceLabel} booking is created — Booking ID *${referenceId}*.\n\n` +
    // Client 2026-10-14 — passengers, route / destination and travel date in the confirmation.
    (tripSummary ? `${tripSummary.split(" · ").join("\n")}\n\n` : "") +
    `Tap *Pay Now* below to complete your payment securely.\n${payUrl}\n\n` +
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

/** Client doc 2026-10-20 (G1) — the FAQs list: numbered questions, or type your own. */
export function faqList(questions: string[]): string {
  if (questions.length === 0) return `❓ *FAQs*\nType your question and I'll find the answer. Type "menu" to go back.`;
  return `❓ *FAQs*\nReply with a number, or type your own question:\n${questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}\nType "menu" to go back.`;
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
