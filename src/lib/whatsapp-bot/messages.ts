import { siteConfig } from "@/lib/site-config";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";

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

export function leadCreated(referenceId: string, serviceLabel: string): string {
  return (
    `All set! Your ${serviceLabel} request is submitted — reference *${referenceId}*.\n\n` +
    `Our team will review it and reach out shortly. You can also reach us anytime at ${siteConfig.contact.phone} or ${siteConfig.contact.email}.\n\n` +
    `Type "menu" if you'd like to start another request.`
  );
}

export function handoff(reason: string): string {
  return (
    `${reason} Let me connect you with our support team — ` +
    `they'll follow up shortly. You can also reach us directly:\n` +
    `📞 ${siteConfig.contact.phone}\n✉️ ${siteConfig.contact.email}\n💬 ${siteConfig.contact.whatsappHref}`
  );
}

export function stillHandedOff(): string {
  return `Our team has this — they'll reach out shortly. Need anything else in the meantime? Type "menu" to start over.`;
}

export function trackInstructions(): string {
  return (
    `You can check your request's status here: ${siteConfig.url}/track — just enter the reference ID we sent you.\n\n` +
    `Don't have it handy? Message us your name or mobile number and our team will look it up.\n\n` +
    `Type "menu" anytime to start over.`
  );
}

export function faqFooter(): string {
  return `_Did that answer your question? Type "menu" to see what else I can help with, or "agent" to talk to our team._`;
}

export function invalidAnswer(error: string, retryPrompt: string): string {
  return `${error}\n\n${retryPrompt}`;
}

/** Visa_Extension.md §2/§25: no eligible TripNexio-issued visa found — routes to Visa Change (inside UAE) or New Visa (outside UAE) instead of creating an Extension lead. */
export function visaExtensionIneligible(redirectLabel: string): string {
  return (
    `We currently provide visa extension services only for visas issued through TripNexio, and we couldn't find a matching visa for these details.\n\n` +
    `It looks like *${redirectLabel}* may be the right service for you instead. Type "menu" to start that request, or "agent" to talk to our team.`
  );
}
