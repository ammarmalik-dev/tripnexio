import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { writeAudit } from "@/lib/audit/log";
import { deleteUploadedFile } from "@/lib/storage/local-file-storage";
import { getSystemConfig } from "@/lib/settings/system-config";

const TERMINAL_BOOKING_STATUSES = ["COMPLETED", "CANCELLED", "REFUNDED"] as const;

function isRetainedType(type: string): boolean {
  return /passport/i.test(type) || /visa/i.test(type);
}

/**
 * New_Visa.md §27 (Step 21, audit §7.5): "After 3 months: keep Passport
 * Front Page, keep Visa Copy/PDF, auto-delete other customer-uploaded
 * document files. Customer/Buyer/Passenger/Booking history remains."
 *
 * "3 months past processing completion" is read as: the booking has
 * reached a terminal BookingStatus (COMPLETED/CANCELLED/REFUNDED — the
 * coarse enum every other part of this app already treats as "the case is
 * done," see Step 19), and it's been at least 3 months since
 * Booking.updatedAt. This is a proxy, not an exact "completed at"
 * timestamp (Booking has no dedicated field for that) — it's reliable
 * today because nothing currently re-touches Booking.status after it goes
 * terminal, but would need revisiting if a future change (e.g. Step 19
 * Units 2-3's serviceStatus cascade) starts writing to `status` again
 * after completion.
 *
 * Only ever purges the FILE (deleteUploadedFile + fileUrl -> null,
 * purgedAt set) — the Document row itself stays, matching "history
 * remains." Documents not attached to any Booking (e.g. a passport photo
 * from an abandoned lead that never became a booking) are out of scope —
 * there's no "processing completion" for something that was never
 * processed.
 *
 * `dryRun: true` in the request body computes what WOULD be purged
 * without deleting anything or writing to the DB — the roadmap prompt's
 * own explicit ask: "dry-run the purge job against test data before ever
 * running it against real documents." n8n's own scheduled call omits this
 * (defaults to a real run); a manual dry-run check can pass it explicitly.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  let dryRun = false;
  try {
    const body = await request.json();
    dryRun = body?.dryRun === true;
  } catch {
    // No body (or invalid JSON) is fine — defaults to a real run, matching every other automation route's tolerant parsing.
  }

  try {
    const summary = await recordAutomationRun("document-retention", async () => {
      // Step 45 (Admin FINAL handover §19, "data retention") — replaces
      // the previously hardcoded 90-day constant.
      const { documentRetentionDays } = await getSystemConfig();
      const cutoff = new Date(Date.now() - documentRetentionDays * 24 * 60 * 60 * 1000);

      const candidates = await db.document.findMany({
        where: {
          bookingId: { not: null },
          fileUrl: { not: null },
          purgedAt: null,
          booking: { status: { in: [...TERMINAL_BOOKING_STATUSES] }, updatedAt: { lte: cutoff } },
        },
        include: { booking: true },
      });

      const eligible = candidates.filter((doc) => !isRetainedType(doc.type));
      const retained = candidates.length - eligible.length;

      if (dryRun) {
        return {
          dryRun: true,
          checked: candidates.length,
          wouldPurge: eligible.length,
          retainedByType: retained,
          wouldPurgeDocumentIds: eligible.map((doc) => doc.id),
        };
      }

      let purged = 0;
      for (const document of eligible) {
        // Logged BEFORE deleting, per the roadmap prompt's own explicit
        // instruction — if the file delete or DB update fails partway,
        // there's still a permanent record the purge was attempted.
        await writeAudit(db, {
          entityType: "Document",
          entityId: document.id,
          action: "PURGE",
          note: `File purged by 3-month retention policy (type "${document.type}", booking ${document.booking!.bookingId}, originally uploaded ${document.createdAt.toISOString()})`,
        });
        await deleteUploadedFile(document.fileUrl!);
        await db.document.update({ where: { id: document.id }, data: { fileUrl: null, purgedAt: new Date() } });
        purged++;
      }

      return { dryRun: false, checked: candidates.length, purged, retainedByType: retained };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/document-retention]", error);
    return jsonError(500, "Document retention job failed.");
  }
}
