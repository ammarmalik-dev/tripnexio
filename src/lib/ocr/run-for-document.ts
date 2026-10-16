import { db } from "../db";
import { runPassportExtraction } from "./extract-passport";
import { runTicketExtraction } from "./extract-ticket";
import { runVisaExtraction } from "./extract-visa";

/**
 * Runs the OCR pipeline that fits a document's type — passport, ticket or visa — then (inside each pipeline)
 * the check against the entered details (client doc 2026-10-15, J4). Used by every upload path: staff,
 * customer account, pay / quote pages and delivered outputs. Never throws; returns whether OCR ran.
 */
export async function runOcrForDocument(documentId: string): Promise<boolean> {
  try {
    const document = await db.document.findUnique({ where: { id: documentId }, select: { id: true, type: true, passengerId: true, bookingId: true, fileUrl: true } });
    if (!document?.fileUrl) return false;
    if (/passport/i.test(document.type) && document.passengerId) {
      await runPassportExtraction(document.id);
      return true;
    }
    if (!document.passengerId && !document.bookingId) return false;
    if (/ticket/i.test(document.type)) {
      await runTicketExtraction(document.id);
      return true;
    }
    if (/visa/i.test(document.type)) {
      await runVisaExtraction(document.id);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[ocr] run for document failed", error);
    return false;
  }
}
