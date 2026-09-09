import { z } from "zod";

/**
 * Whatever the staff member ends up confirming — pre-filled from OCR, but
 * always editable before saving (never trust OCR output blind). Deliberately
 * one loose `Record<string, string>` shape shared across all three
 * extraction types (PASSPORT/TICKET/VISA) rather than three separate
 * strictly-typed field schemas — the server already knows which type this
 * extraction is (read from the stored row, never sent by the client) and
 * only PASSPORT's confirm path writes named fields onto a real record
 * (Passenger); TICKET/VISA's confirm path just persists whatever keys/
 * values staff submit back into `extractedFields` as the final, reviewed
 * record. A per-type strict schema would just re-describe the same field
 * names types.ts's Ocr*Fields interfaces already document, for no real
 * validation benefit at this stage.
 */
const anyFieldsSchema = z.record(z.string(), z.string().trim().max(200).optional());

export const reviewDocumentExtractionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), fields: anyFieldsSchema }),
  z.object({ action: z.literal("reject") }),
]);

export type ReviewDocumentExtractionValues = z.infer<typeof reviewDocumentExtractionSchema>;
