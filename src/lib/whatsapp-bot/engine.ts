import { createLeadFromSubmission, notifyLeadReceived } from "../leads/create-lead";
import { tripFactsForLead, tripSummaryLine } from "../leads/trip-summary";
import { findPriorTripNexioVisaByPassport } from "../leads/visa-extension-eligibility";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getAiProvider } from "./get-ai-provider";
import { answerFaqQuestion } from "@/lib/faq/answer-faq";
import { BOT_INTENTS, isServiceIntent } from "./intents";
import { buildWelcomeMenu, serviceTypeFromMenuId, MENU_TRACK_ID, MENU_AGENT_ID, MENU_FAQ_ID } from "./menu";
import { getNextField, buildLeadDetails, buildLeadPassengers, botPassengers } from "./flows";
import { whatsappStatusReply } from "./status-reply";
import { priceLeadForDirectPayment } from "../checkout/lead-direct-payment";
import { db } from "../db";
import { createAutoCheckout } from "../checkout/create-auto-checkout";
import { siteConfig } from "../site-config";
import * as messages from "./messages";
import { AWAITING_VISA_COPY, visaCopyTextReply } from "./visa-copy";
import { writeAudit } from "../audit/log";
import { getSiteContact } from "../settings/system-config";
import type { ServiceType } from "../../generated/prisma/enums";

const SERVICE_TYPES = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"] as const;
/** Paid straight from the chat (no quotation) — client testing 2026-10-09. */
const DIRECT_PAYMENT = new Set<ServiceType>(["NEW_VISA", "OTB", "RETURN_TICKET"]);
const AGENT_RE = /^(agent|human|talk to (an )?agent|customer care|agent se baat)[.!]?$/i;
/** "status", "track", "where is my visa"… — answered in the chat. */
const TRACK_RE = /^(status|track|tracking|my status|check status|track (my )?(request|booking|status)|where is my (visa|booking|ticket|otb))\b/i;
import type { WhatsAppConversation } from "../../generated/prisma/client";

export interface EngineResult {
  /** Empty = no reply (a chat that is with the team). */
  replyText: string;
  /** Present only for the greeting menu — the webhook route sends this as a real tappable WhatsApp list instead of (not in addition to) replyText, which stays as the plain-text fallback for the message log/console gateway. */
  replyMenu?: Awaited<ReturnType<typeof buildWelcomeMenu>>;
  nextState: string;
  nextServiceType: ServiceType | null;
  nextCollectedFields: Record<string, string>;
  leadId?: string;
  /** Client 2026-10-14 — sent as a message with a tappable button (e.g. Pay Now) instead of plain replyText. */
  replyCta?: { label: string; url: string };
}

async function greetingReply(profileName: string | null): Promise<EngineResult> {
  return {
    replyText: messages.welcomeMenu(profileName),
    replyMenu: await buildWelcomeMenu(),
    nextState: "GREETING",
    nextServiceType: null,
    nextCollectedFields: {},
  };
}

const RESTART_RE = /^(restart|start over|menu|hi|hello|hey)$/i;
const FAQ_STATE = "FAQ";
const FAQ_LIST_SIZE = 9;

/**
 * The bot's whole conversational state machine, in one place: given the
 * current persisted WhatsAppConversation and the customer's new inbound
 * message, decides what to say back and what state to persist next. Pure
 * with respect to persistence — the caller (the webhook route) is the one
 * that actually writes the returned state back to WhatsAppConversation and
 * sends the reply; this function only ever reads (Faq, Airport/Border via
 * getNextField, and — once a request is complete — writes exactly once via
 * createLeadFromSubmission, the SAME function every website intake route
 * calls, so a WhatsApp-originated Lead is created identically to a
 * website one).
 */
export async function handleInboundMessage(
  conversation: WhatsAppConversation,
  messageText: string,
  profileName: string | null
): Promise<EngineResult> {
  const trimmed = messageText.trim();
  messages.setContactDetails(await getSiteContact());

  try {
    // Universal escape hatch — works from any state, including mid-collection or handed-off
    // (none of the fields the bot ever asks for would legitimately be answered "hi"/"menu"/"restart").
    if (RESTART_RE.test(trimmed)) {
      return await greetingReply(profileName);
    }

    // Client doc 2026-10-20 (G5) — the "Our team has this" reply went out once, at handover; after that the
    // bot stays quiet while the team chats (each message alerts the POC instead — see the webhook).
    if (conversation.state === "HANDED_OFF") {
      return {
        replyText: "",
        nextState: "HANDED_OFF",
        nextServiceType: conversation.serviceType,
        nextCollectedFields: conversation.collectedFields as Record<string, string>,
      };
    }

    // Client testing 2026-10-09 (B21) — waiting for a visa copy; a typed message gets a reminder ("skip" ends it).
    if (conversation.state === AWAITING_VISA_COPY) {
      return visaCopyTextReply(conversation.collectedFields as Record<string, string>, trimmed);
    }

    const effectiveState = conversation.state === "COMPLETED" ? "GREETING" : conversation.state;

    // Client doc 2026-10-20 (G1) — in the FAQs list: a number opens that answer, anything else is a question.
    if (effectiveState === FAQ_STATE && !serviceTypeFromMenuId(trimmed, SERVICE_TYPES) && !trimmed.startsWith("MENU_")) {
      const ids = ((conversation.collectedFields ?? {}) as Record<string, string>).faqIds?.split(",").filter(Boolean) ?? [];
      const n = /^\d{1,2}$/.test(trimmed) ? Number(trimmed) : 0;
      if (n >= 1 && n <= ids.length) {
        const faq = await db.faq.findFirst({ where: { id: ids[n - 1], active: true, published: true }, select: { answer: true } });
        if (faq) return { replyText: `${faq.answer}\n\n${messages.faqFooter()}`, nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
      }
      return await answerFaqOrHandoff(trimmed);
    }

    if (effectiveState === "COLLECTING" && conversation.serviceType) {
      // Client 2026-10-23 — the bot's own replies say 'type "agent" for help' mid-flow; that now reaches the team
      // (the webhook keeps the details collected so far on the captured lead).
      if (AGENT_RE.test(trimmed)) {
        return { replyText: messages.handoff("Sure —"), nextState: "HANDED_OFF", nextServiceType: conversation.serviceType, nextCollectedFields: {} };
      }
      return await continueCollecting(conversation.serviceType, conversation.waId, conversation.collectedFields as Record<string, string>, trimmed);
    }

    // A tapped menu row is handled before any AI call — Meta echoes the row
    // id back as the message body for an interactive reply (see the webhook
    // route), so this only ever fires for an actual tap, never a
    // coincidentally-matching typed string (row ids are prefixed "MENU_" and
    // not something a customer would type unprompted). A tap maps deterministically
    // to the exact same startCollecting()/handoff paths free text would
    // eventually classify into — no separate menu-only code path to maintain.
    const tappedService = serviceTypeFromMenuId(trimmed, SERVICE_TYPES);
    if (tappedService) {
      return await startCollecting(tappedService);
    }
    // Client testing 2026-10-09 (C5) — status answered inside the chat (no website redirect).
    if (trimmed === MENU_TRACK_ID || TRACK_RE.test(trimmed)) {
      return { replyText: await whatsappStatusReply(conversation.waId), nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
    }
    if (trimmed === MENU_FAQ_ID || /^(faq|faqs)$/i.test(trimmed)) {
      const faqs = await db.faq.findMany({
        where: { active: true, published: true, serviceType: null, countryId: null },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        take: FAQ_LIST_SIZE,
        select: { id: true, question: true },
      });
      return {
        replyText: messages.faqList(faqs.map((faq) => faq.question)),
        nextState: FAQ_STATE,
        nextServiceType: null,
        nextCollectedFields: { faqIds: faqs.map((faq) => faq.id).join(",") },
      };
    }
    if (trimmed === MENU_AGENT_ID) {
      return { replyText: messages.handoff("Sure —"), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
    }

    // GREETING (or freshly reset from COMPLETED) — classify intent.
    const ai = getAiProvider();
    const classification = await ai.classifyIntent(trimmed);

    if (classification.intent === BOT_INTENTS.HUMAN_HANDOFF) {
      return { replyText: messages.handoff("Sure —"), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
    }

    if (isServiceIntent(classification.intent)) {
      return await startCollecting(classification.intent);
    }

    if (classification.intent === BOT_INTENTS.FAQ_QUESTION) {
      return await answerFaqOrHandoff(trimmed);
    }

    return await greetingReply(profileName);
  } catch (error) {
    console.error("[whatsapp-bot] engine error", error);
    return { replyText: messages.handoff("Something went wrong on our end."), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
  }
}

async function startCollecting(serviceType: ServiceType): Promise<EngineResult> {
  const field = await getNextField(serviceType, {});
  if (!field || field.unavailable) {
    return { replyText: messages.handoff("This service isn't available to request right now."), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
  }
  return {
    replyText: messages.startingService(serviceType, field.prompt),
    nextState: "COLLECTING",
    nextServiceType: serviceType,
    nextCollectedFields: {},
  };
}

async function continueCollecting(
  serviceType: ServiceType,
  waId: string,
  collected: Record<string, string>,
  raw: string
): Promise<EngineResult> {
  const currentField = await getNextField(serviceType, collected);

  // Every field already collected somehow (shouldn't normally reach here — COMPLETED handles this) — safety net.
  if (!currentField) {
    return await greetingReply(null);
  }
  if (currentField.unavailable) {
    return { replyText: messages.handoff("That option isn't available right now."), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
  }

  const parsed = await currentField.parse(raw);
  if (!parsed.ok) {
    return {
      replyText: messages.invalidAnswer(parsed.error ?? "That doesn't look right.", currentField.prompt),
      nextState: "COLLECTING",
      nextServiceType: serviceType,
      nextCollectedFields: collected,
    };
  }

  const nextCollected = { ...collected, [currentField.fieldKey]: parsed.value ?? "" };
  const nextField = await getNextField(serviceType, nextCollected);

  if (nextField) {
    if (nextField.unavailable) {
      return { replyText: messages.handoff("That option isn't available right now."), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
    }
    return { replyText: nextField.prompt, nextState: "COLLECTING", nextServiceType: serviceType, nextCollectedFields: nextCollected };
  }

  // Client doc 2026-10-15 — Visa Extension: outside the UAE only New Visa is offered; inside the UAE
  // with no TripNexio visa for any passenger, "TripNexio Visa Not Found" offers Visa Change / New Visa.
  // No Extension lead is created in either case.
  let unmatchedApplicants: string[] = [];
  if (serviceType === "VISA_EXTENSION") {
    if (nextCollected.insideUAE === "no") {
      return {
        replyText: messages.extensionOutsideUae(),
        replyMenu: await buildWelcomeMenu({ only: ["NEW_VISA"], bodyText: messages.extensionOutsideUae() }),
        nextState: "GREETING",
        nextServiceType: null,
        nextCollectedFields: {},
      };
    }
    const travellers = botPassengers(nextCollected);
    const matches = await Promise.all(travellers.map((p) => (p.passportNumber ? findPriorTripNexioVisaByPassport(p.passportNumber) : Promise.resolve(null))));
    if (!matches.some(Boolean)) {
      return {
        replyText: messages.tripNexioVisaNotFound(),
        replyMenu: await buildWelcomeMenu({ only: ["VISA_CHANGE", "NEW_VISA"], bodyText: messages.tripNexioVisaNotFound() }),
        nextState: "GREETING",
        nextServiceType: null,
        nextCollectedFields: {},
      };
    }
    unmatchedApplicants = travellers.filter((_, index) => !matches[index]).map((p) => p.fullName ?? nextCollected.fullName);
  }

  // Every field collected — create the Lead exactly like the website does.
  try {
    const details = await buildLeadDetails(serviceType, nextCollected);
    const passengers = await buildLeadPassengers(serviceType, nextCollected);
    const result = await createLeadFromSubmission({
      serviceType,
      source: "WhatsApp Bot",
      contact: { fullName: nextCollected.fullName, mobile: waId, email: nextCollected.email },
      passengers,
      details: unmatchedApplicants.length > 0 ? { ...details, noPriorVisa: true, noPriorVisaApplicants: unmatchedApplicants } : details,
      // Client doc 2026-10-15 — the bot's own reply is the confirmation: no second WhatsApp message
      // (the request-received email still goes out, below).
      deferLeadReceivedNotice: true,
    });
    if (!DIRECT_PAYMENT.has(serviceType)) await notifyLeadReceived(result.leadId, { skipWhatsApp: true });

    // New Visa / OTB / Return Ticket pay right after the request (client
    // testing 2026-10-09): priced from Admin config exactly like the CRM's
    // direct payment link, Booking ID = the reference. A failure (e.g. no
    // configured price) never loses the Lead — staff follow up instead.
    let payUrl: string | null = null;
    if (DIRECT_PAYMENT.has(serviceType)) {
      try {
        const lead = await db.lead.findUnique({ where: { id: result.leadId }, select: { serviceType: true, details: true, paxCount: true } });
        const price = lead ? await priceLeadForDirectPayment(lead) : null;
        const checkout = price?.ok
          ? await createAutoCheckout({
              leadId: result.leadId,
              serviceType: price.serviceType,
              totalPrice: price.totalPrice,
              vendorCost: price.vendorCost,
              invoiceLines: price.invoiceLines,
              actorLabel: "WhatsApp bot checkout",
              // This reply carries the Pay Now button — one WhatsApp message, not two (client 2026-10-14).
              skipWhatsAppNotice: true,
            })
          : null;
        if (checkout) payUrl = `${siteConfig.url}/pay/${checkout.token}`;
      } catch (checkoutError) {
        console.error("[whatsapp-bot] auto checkout failed", checkoutError instanceof Error ? checkoutError.name : "error");
      }
      if (!payUrl) await notifyLeadReceived(result.leadId, { skipWhatsApp: true });
    }

    if (unmatchedApplicants.length > 0) {
      await writeAudit(db, {
        entityType: "Lead",
        entityId: result.leadId,
        action: "NO_PRIOR_VISA",
        note: `No prior TripNexio visa found for ${unmatchedApplicants.join(", ")} — staff to verify`,
      });
    }

    // Client doc 2026-10-15 — Visa Extension: thank-you + a link to upload each passenger's passport and visa copies.
    if (serviceType === "VISA_EXTENSION") {
      const lead = await db.lead.findUnique({ where: { id: result.leadId }, select: { customerToken: true } });
      const uploadUrl = lead?.customerToken ? `${siteConfig.url}/quote/${lead.customerToken}` : null;
      return {
        replyText: messages.extensionUploadRequest(result.referenceId, uploadUrl),
        ...(uploadUrl ? { replyCta: { label: "Upload Documents", url: uploadUrl } } : {}),
        nextState: "COMPLETED",
        nextServiceType: serviceType,
        nextCollectedFields: nextCollected,
        leadId: result.leadId,
      };
    }

    return {
      replyText: payUrl
        ? messages.leadCreatedWithPayLink(result.referenceId, SERVICE_TYPE_LABELS[serviceType], payUrl, tripSummaryLine(await tripFactsForLead(result.leadId)))
        : messages.leadCreated(result.referenceId, serviceType),
      ...(payUrl ? { replyCta: { label: "Pay Now", url: payUrl } } : {}),
      nextState: "COMPLETED",
      nextServiceType: serviceType,
      nextCollectedFields: nextCollected,
      leadId: result.leadId,
    };
  } catch (error) {
    console.error("[whatsapp-bot] createLeadFromSubmission failed", error);
    return { replyText: messages.handoff("Something went wrong while saving your request."), nextState: "HANDED_OFF", nextServiceType: null, nextCollectedFields: {} };
  }
}

async function answerFaqOrHandoff(question: string): Promise<EngineResult> {
  // Step 29 (audit §2.8) — shared with the website's Ask AI page
  // (POST /api/ai/ask) via src/lib/faq/answer-faq.ts, not duplicated here.
  const result = await answerFaqQuestion(question);

  if (result.answer) {
    return { replyText: `${result.answer}\n\n${messages.faqFooter()}`, nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
  }
  return {
    replyText: messages.handoff("I don't have a confident answer to that."),
    nextState: "HANDED_OFF",
    nextServiceType: null,
    nextCollectedFields: {},
  };
}
