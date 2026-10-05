import { db } from "../db";

interface PublishCheckInput {
  countryId: string;
  whatYouNeed: string[];
  documents: string[];
}

/**
 * Client rule (2026-10-05): a New Visa country page can only be published once
 * it has "What You'll Need", "Documents Required" and at least one published
 * FAQ for that country. Returns what is still missing (empty = OK to publish).
 */
export async function countryPagePublishBlockers(input: PublishCheckInput): Promise<string[]> {
  const missing: string[] = [];
  if (input.whatYouNeed.length === 0) missing.push("What You'll Need");
  if (input.documents.length === 0) missing.push("Documents Required");
  const faqCount = await db.faq.count({
    where: { serviceType: "NEW_VISA", countryId: input.countryId, active: true, published: true },
  });
  if (faqCount === 0) missing.push("at least one published FAQ for this country (Admin → FAQs)");
  return missing;
}

export function publishBlockedMessage(missing: string[]): string {
  return `Add ${missing.join(", ")} before publishing this page.`;
}
