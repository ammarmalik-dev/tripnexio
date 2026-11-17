/** Client doc 16 Nov (J10) — how a lead came in (client-safe: no Prisma import). */
export const ENTRY_SOURCES = ["WEBSITE", "WHATSAPP", "MANUAL"] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];
export const ENTRY_SOURCE_OPTIONS: { value: EntrySource; label: string }[] = [
  { value: "WEBSITE", label: "Website" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "MANUAL", label: "Manual" },
];
