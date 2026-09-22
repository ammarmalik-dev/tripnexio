import { createLeadFromSubmission } from "../leads/create-lead";
import { checkVisaExtensionEligibility, getIneligibleRedirect } from "../leads/visa-extension-eligibility";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getAiProvider } from "./get-ai-provider";
import { answerFaqQuestion } from "@/lib/faq/answer-faq";
import { BOT_INTENTS, isServiceIntent } from "./intents";
import { buildWelcomeMenu, serviceTypeFromMenuId, MENU_TRACK_ID, MENU_AGENT_ID } from "./menu";
import { getNextField, buildLeadDetails } from "./flows";
import * as messages from "./messages";
import type { ServiceType } from "../../generated/prisma/enums";

const SERVICE_TYPES = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"] as const;
import type { WhatsAppConversation } from "../../generated/prisma/client";

export interface EngineResult {
  replyText: string;
  /** Present only for the greeting menu — the webhook route sends this as a real tappable WhatsApp list instead of (not in addition to) replyText, which stays as the plain-text fallback for the message log/console gateway. */
  replyMenu?: Awaited<ReturnType<typeof buildWelcomeMenu>>;
  nextState: string;
  nextServiceType: ServiceType | null;
  nextCollectedFields: Record<string, string>;
  leadId?: string;
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

  try {
    // Universal escape hatch — works from any state, including mid-collection or handed-off
    // (none of the fields the bot ever asks for would legitimately be answered "hi"/"menu"/"restart").
    if (RESTART_RE.test(trimmed)) {
      return await greetingReply(profileName);
    }

    if (conversation.state === "HANDED_OFF") {
      return {
        replyText: messages.stillHandedOff(),
        nextState: "HANDED_OFF",
        nextServiceType: conversation.serviceType,
        nextCollectedFields: conversation.collectedFields as Record<string, string>,
      };
    }

    const effectiveState = conversation.state === "COMPLETED" ? "GREETING" : conversation.state;

    if (effectiveState === "COLLECTING" && conversation.serviceType) {
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
    if (trimmed === MENU_TRACK_ID) {
      return { replyText: messages.trackInstructions(), nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
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

  // Visa_Extension.md §2/§25: no eligible TripNexio-issued visa -> route to
  // Visa Change/New Visa instead of creating an Extension lead. Same check
  // the website's POST /api/leads/visa-extension route runs, so a
  // WhatsApp-originated request can't bypass it.
  if (serviceType === "VISA_EXTENSION") {
    const eligibility = await checkVisaExtensionEligibility({
      passportNumber: nextCollected.passportNumber,
      dob: nextCollected.dob,
      mobile: waId,
    });
    if (!eligibility.eligible) {
      const redirect = getIneligibleRedirect(nextCollected.insideUAE === "yes" ? "yes" : "no");
      return {
        replyText: messages.visaExtensionIneligible(redirect.label),
        nextState: "GREETING",
        nextServiceType: null,
        nextCollectedFields: {},
      };
    }
  }

  // Every field collected — create the Lead exactly like the website does.
  try {
    const details = await buildLeadDetails(serviceType, nextCollected);
    const result = await createLeadFromSubmission({
      serviceType,
      source: "WhatsApp Bot",
      contact: { fullName: nextCollected.fullName, mobile: waId, email: nextCollected.email },
      details,
    });
    return {
      replyText: messages.leadCreated(result.referenceId, SERVICE_TYPE_LABELS[serviceType]),
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
