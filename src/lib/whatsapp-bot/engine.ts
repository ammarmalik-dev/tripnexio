import { db } from "../db";
import { createLeadFromSubmission } from "../leads/create-lead";
import { checkVisaExtensionEligibility, getIneligibleRedirect } from "../leads/visa-extension-eligibility";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getAiProvider } from "./get-ai-provider";
import { BOT_INTENTS, isServiceIntent } from "./intents";
import { getNextField, buildLeadDetails } from "./flows";
import * as messages from "./messages";
import type { ServiceType } from "../../generated/prisma/enums";
import type { WhatsAppConversation } from "../../generated/prisma/client";

export interface EngineResult {
  replyText: string;
  nextState: string;
  nextServiceType: ServiceType | null;
  nextCollectedFields: Record<string, string>;
  leadId?: string;
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
      return { replyText: messages.welcomeMenu(profileName), nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
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

    return { replyText: messages.welcomeMenu(profileName), nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
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
    return { replyText: messages.welcomeMenu(null), nextState: "GREETING", nextServiceType: null, nextCollectedFields: {} };
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
  const faqs = await db.faq.findMany({ where: { active: true, published: true } });
  const ai = getAiProvider();
  const result = await ai.answerFaq(
    question,
    faqs.map((faq) => ({ question: faq.question, answer: faq.answer, category: faq.category }))
  );

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
