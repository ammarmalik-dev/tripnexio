import { db } from "../db";
import { writeAudit } from "../audit/log";
import { checkBase64Upload } from "../uploads/validate-upload";
import { saveUploadedFile } from "../storage/local-file-storage";
import type { DownloadedMedia } from "../whatsapp/gateway";
import type { ServiceType } from "../../generated/prisma/enums";
import * as messages from "./messages";

/**
 * Client testing 2026-10-09 (B21) — a Visa Extension request from WhatsApp
 * whose applicant has no visa issued through TripNexio (or whose passport/DOB
 * didn't match) still becomes a lead, and the bot then asks for a copy of the
 * current visa in the chat, one applicant at a time. Each photo/PDF the
 * customer sends is saved as that applicant's VISA_COPY document (same
 * storage and checks as a website upload).
 */
export const AWAITING_VISA_COPY = "AWAITING_VISA_COPY";

export interface PendingVisaCopy {
  passengerId: string;
  name: string;
}

interface VisaCopyStep {
  replyText: string;
  nextState: string;
  nextServiceType: ServiceType | null;
  nextCollectedFields: Record<string, string>;
}

export function pendingVisaCopies(fields: Record<string, string>): PendingVisaCopy[] {
  try {
    const parsed = JSON.parse(fields.pendingVisaCopies ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((row): row is PendingVisaCopy => typeof row?.passengerId === "string" && typeof row?.name === "string")
      : [];
  } catch {
    return [];
  }
}

/** The state that asks for the first applicant's visa copy. */
export function askForVisaCopies(leadId: string, pending: PendingVisaCopy[]): Pick<VisaCopyStep, "nextState" | "nextCollectedFields"> {
  return { nextState: AWAITING_VISA_COPY, nextCollectedFields: { leadId, pendingVisaCopies: JSON.stringify(pending) } };
}

/** A text message while a visa copy is awaited: "skip" ends it (staff follow up), anything else is a reminder. */
export function visaCopyTextReply(fields: Record<string, string>, text: string): VisaCopyStep {
  const pending = pendingVisaCopies(fields);
  if (pending.length === 0 || /^skip$/i.test(text.trim())) {
    return { replyText: messages.visaCopySkipped(), nextState: "COMPLETED", nextServiceType: "VISA_EXTENSION", nextCollectedFields: {} };
  }
  return { replyText: messages.visaCopyReminder(pending[0].name), nextState: AWAITING_VISA_COPY, nextServiceType: "VISA_EXTENSION", nextCollectedFields: fields };
}

/** A photo/PDF arrived while a visa copy is awaited: save it for the first pending applicant and ask for the next. */
export async function receiveVisaCopy(fields: Record<string, string>, media: DownloadedMedia | null): Promise<VisaCopyStep> {
  const pending = pendingVisaCopies(fields);
  const keep: VisaCopyStep = { replyText: "", nextState: AWAITING_VISA_COPY, nextServiceType: "VISA_EXTENSION", nextCollectedFields: fields };
  if (pending.length === 0) return visaCopyTextReply(fields, "skip");
  if (!media) return { ...keep, replyText: messages.visaCopyUnreadable(pending[0].name) };

  const check = checkBase64Upload(media.base64);
  if (!check.ok) return { ...keep, replyText: messages.visaCopyUnreadable(pending[0].name) };

  const [current, ...rest] = pending;
  try {
    const { url } = await saveUploadedFile(media.base64);
    const document = await db.document.create({ data: { passengerId: current.passengerId, type: "VISA_COPY", status: "RECEIVED", fileUrl: url } });
    await writeAudit(db, { entityType: "Document", entityId: document.id, action: "CREATE", note: `Visa copy received on WhatsApp for ${current.name}` });
    if (fields.leadId) {
      await writeAudit(db, { entityType: "Lead", entityId: fields.leadId, action: "VISA_COPY_RECEIVED", note: `Visa copy received on WhatsApp for ${current.name}` });
    }
  } catch (error) {
    console.error("[whatsapp-bot] couldn't save visa copy", error instanceof Error ? error.name : "error");
    return { ...keep, replyText: messages.visaCopyUnreadable(current.name) };
  }

  if (rest.length === 0) {
    return { replyText: messages.visaCopyAllReceived(), nextState: "COMPLETED", nextServiceType: "VISA_EXTENSION", nextCollectedFields: {} };
  }
  return { ...keep, replyText: messages.visaCopyNext(rest[0].name), nextCollectedFields: { ...fields, pendingVisaCopies: JSON.stringify(rest) } };
}
