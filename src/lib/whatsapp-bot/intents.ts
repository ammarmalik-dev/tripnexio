import type { ServiceType } from "../../generated/prisma/enums";

/** Every intent the bot can classify an inbound message as. */
export const BOT_INTENTS = {
  NEW_VISA: "NEW_VISA",
  VISA_EXTENSION: "VISA_EXTENSION",
  VISA_CHANGE: "VISA_CHANGE",
  FLIGHT_SPECIAL_FARE: "FLIGHT_SPECIAL_FARE",
  RETURN_TICKET: "RETURN_TICKET",
  OTB: "OTB",
  FAQ_QUESTION: "FAQ_QUESTION",
  HUMAN_HANDOFF: "HUMAN_HANDOFF",
  GREETING: "GREETING",
  UNKNOWN: "UNKNOWN",
} as const;

export type BotIntent = (typeof BOT_INTENTS)[keyof typeof BOT_INTENTS];

const SERVICE_INTENTS: BotIntent[] = [
  BOT_INTENTS.NEW_VISA,
  BOT_INTENTS.VISA_EXTENSION,
  BOT_INTENTS.VISA_CHANGE,
  BOT_INTENTS.FLIGHT_SPECIAL_FARE,
  BOT_INTENTS.RETURN_TICKET,
  BOT_INTENTS.OTB,
];

/**
 * Step 51 — narrowed to `Exclude<ServiceType, "OTHER">`, not the full
 * `ServiceType`: the bot never classifies a message as the CRM-only
 * "Other" service (it has no bot-facing flow at all), so BotIntent itself
 * was never widened to include it.
 */
export function isServiceIntent(intent: BotIntent): intent is Exclude<ServiceType, "OTHER"> {
  return (SERVICE_INTENTS as string[]).includes(intent);
}

export interface IntentClassification {
  intent: BotIntent;
  confidence: number;
}
