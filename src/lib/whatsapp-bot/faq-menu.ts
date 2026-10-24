import { db } from "../db";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client 2026-10-25 — "all FAQs must show in WhatsApp … by service or country". The FAQs menu first lists the
 * topics that have published FAQs (General + each service), then every question of the picked topic; typing a
 * country name lists that country's FAQs. The state lives in the conversation's collected fields.
 */
export type FaqMenuFields = { faqLevel: "TOPIC"; faqTopics: string } | { faqLevel: "LIST"; faqIds: string };

const GENERAL = "GENERAL";
const SERVICE_ORDER: ServiceType[] = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"];
/** Keeps one WhatsApp message well under Meta's 4,096-character limit. */
const MAX_LIST_CHARS = 3300;

const published = { active: true, published: true } as const;

/** The topic menu: only topics that have at least one published FAQ. */
export async function faqTopicMenu(): Promise<{ text: string; fields: FaqMenuFields }> {
  const counts = await db.faq.groupBy({ by: ["serviceType"], where: published, _count: { _all: true } });
  const has = new Set<string>(counts.filter((row) => row._count._all > 0).map((row) => row.serviceType ?? GENERAL));
  const topics = [GENERAL, ...SERVICE_ORDER].filter((topic) => has.has(topic));
  if (topics.length === 0) {
    return { text: `❓ *FAQs*\nType your question and I'll find the answer. Type "menu" to go back.`, fields: { faqLevel: "LIST", faqIds: "" } };
  }
  const lines = topics.map((topic, index) => `${index + 1}. ${topic === GENERAL ? "General questions" : SERVICE_TYPE_LABELS[topic as ServiceType]}`);
  return {
    text: `❓ *FAQs*\nChoose a topic (reply with a number):\n${lines.join("\n")}\n\nOr type a country name for its visa FAQs, or type your own question. Type "menu" to go back.`,
    fields: { faqLevel: "TOPIC", faqTopics: topics.join(",") },
  };
}

function questionList(heading: string, faqs: { id: string; question: string }[]): { text: string; fields: FaqMenuFields } {
  const lines: string[] = [];
  const ids: string[] = [];
  let length = 0;
  for (const faq of faqs) {
    const line = `${ids.length + 1}. ${faq.question}`;
    if (length + line.length > MAX_LIST_CHARS) break;
    lines.push(line);
    ids.push(faq.id);
    length += line.length + 1;
  }
  const more = faqs.length > ids.length ? `\n(Showing ${ids.length} of ${faqs.length} — type your question to search the rest.)` : "";
  return {
    text: `❓ *${heading}*\nReply with a number, or type your own question:\n${lines.join("\n")}${more}\nType "faq" for the topics or "menu" to go back.`,
    fields: { faqLevel: "LIST", faqIds: ids.join(",") },
  };
}

/** Every question of one topic (General = FAQs without a service; a service = its FAQs not tied to one country). */
export async function faqTopicList(topic: string): Promise<{ text: string; fields: FaqMenuFields } | null> {
  const serviceType = topic === GENERAL ? null : (SERVICE_ORDER.find((service) => service === topic) ?? undefined);
  if (serviceType === undefined) return null;
  const faqs = await db.faq.findMany({
    where: { ...published, serviceType, ...(serviceType ? { countryId: null } : {}) },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true },
  });
  // A service whose FAQs are all country-specific still lists them.
  const list = faqs.length
    ? faqs
    : await db.faq.findMany({ where: { ...published, serviceType }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true, question: true } });
  if (list.length === 0) return null;
  return questionList(serviceType ? `${SERVICE_TYPE_LABELS[serviceType]} FAQs` : "General FAQs", list);
}

/** A typed country name (or code) with published FAQs → its list; null when it isn't one. */
export async function faqCountryList(text: string): Promise<{ text: string; fields: FaqMenuFields } | null> {
  const term = text.trim();
  if (term.length < 2 || term.length > 60) return null;
  const country = await db.country.findFirst({
    where: {
      OR: [{ name: { equals: term, mode: "insensitive" } }, { code: { equals: term, mode: "insensitive" } }],
      faqs: { some: published },
    },
    select: { id: true, name: true },
  });
  if (!country) return null;
  const faqs = await db.faq.findMany({
    where: { ...published, countryId: country.id },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true },
  });
  return faqs.length ? questionList(`${country.name} FAQs`, faqs) : null;
}

/** The picked answer, or null when the number isn't on the list. */
export async function faqAnswerByNumber(faqIds: string, reply: string): Promise<string | null> {
  const ids = faqIds.split(",").filter(Boolean);
  const n = /^\d{1,2}$/.test(reply) ? Number(reply) : 0;
  if (n < 1 || n > ids.length) return null;
  const faq = await db.faq.findFirst({ where: { id: ids[n - 1], ...published }, select: { answer: true } });
  return faq?.answer ?? null;
}
