import { db } from "../db";
import { WELCOME_TEXT } from "./messages";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { SendInteractiveListInput } from "@/lib/whatsapp/gateway";
import type { ServiceType } from "../../generated/prisma/enums";

const MENU_ROW_PREFIX = "MENU_";
export const MENU_TRACK_ID = `${MENU_ROW_PREFIX}TRACK`;
export const MENU_AGENT_ID = `${MENU_ROW_PREFIX}AGENT`;
/** Client doc 2026-10-20 (G1) — the FAQs row. */
export const MENU_FAQ_ID = `${MENU_ROW_PREFIX}FAQ`;

/** A tapped service row's id, e.g. "MENU_NEW_VISA" -> "NEW_VISA" — null for a non-service row or an id that isn't a recognized ServiceType. */
export function serviceTypeFromMenuId(id: string, validServiceTypes: readonly string[]): ServiceType | null {
  if (!id.startsWith(MENU_ROW_PREFIX)) return null;
  const code = id.slice(MENU_ROW_PREFIX.length);
  return validServiceTypes.includes(code) ? (code as ServiceType) : null;
}

/**
 * The button-menu the client asked for (Step 30, `client-message` handover) —
 * an actual tappable WhatsApp list, built from the same Admin-managed
 * `Service` rows the website's ServicesGrid uses (active + displayOrder), so
 * it's genuinely Admin-configurable without a second place to edit it. This
 * only ever supplements the existing free-text "type what you need" AI/
 * keyword intent detection — it never replaces it, per the roadmap's own
 * "don't rebuild the underlying engine" note. A tapped row and free text both
 * end up starting the exact same `startCollecting()` flow.
 */
/**
 * The greeting list of Admin-enabled services. `only` narrows it (e.g. Visa Change / New Visa after
 * "TripNexio Visa Not Found") and `bodyText` replaces the greeting text.
 */
export async function buildWelcomeMenu(options: { only?: ServiceType[]; bodyText?: string } = {}): Promise<SendInteractiveListInput> {
  const services = await db.service.findMany({
    where: { active: true, ...(options.only ? { code: { in: options.only } } : {}) },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true },
  });

  return {
    // Client doc 2026-10-15 — the client's greeting, word for word; product names only (no descriptions).
    bodyText: options.bodyText ?? WELCOME_TEXT,
    buttonText: "See Options",
    sections: [
      {
        title: "Services",
        rows: services.map((service) => ({
          id: `${MENU_ROW_PREFIX}${service.code}`,
          title: ((SERVICE_TYPE_LABELS as Record<string, string>)[service.code] ?? service.name).slice(0, 24),
        })),
      },
      {
        title: "Other",
        rows: [
          { id: MENU_TRACK_ID, title: "Track my request" },
          { id: MENU_FAQ_ID, title: "FAQs" },
          { id: MENU_AGENT_ID, title: "Talk to our team" },
        ],
      },
    ],
  };
}
