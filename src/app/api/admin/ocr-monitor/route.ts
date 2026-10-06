import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { requirePermission } from "@/lib/auth/require-permission";
import { ocrMonitorQuerySchema } from "@/lib/validation/admin-monitoring-schemas";
import { canRetryPassportOcr } from "@/lib/admin/monitoring";
import type { Prisma } from "@/generated/prisma/client";
import type { OcrExtractionStatus } from "@/generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;
const FAILURE_LIST_SIZE = 25;

type StatusCounts = Record<OcrExtractionStatus, number>;

function emptyCounts(): StatusCounts {
  return { PENDING_REVIEW: 0, CONFIRMED: 0, REJECTED: 0 };
}

async function countByStatus(since?: Date): Promise<StatusCounts> {
  const groups = await db.documentExtraction.groupBy({
    by: ["status"],
    where: since ? { createdAt: { gte: since } } : {},
    _count: { _all: true },
  });
  const counts = emptyCounts();
  for (const group of groups) counts[group.status] = group._count._all;
  return counts;
}

function countFailures(since?: Date): Promise<number> {
  return db.auditTrail.count({ where: { action: "OCR_FAILED", ...(since ? { timestamp: { gte: since } } : {}) } });
}

/**
 * P24 item 8 — Admin → OCR Monitor. Read-only view over the existing OCR
 * pipeline: DocumentExtraction rows (one per successful provider call) and
 * AuditTrail OCR_FAILED rows (written by callOcrProviderWithFailureAudit
 * when a provider call throws — those never produce an extraction row).
 * Retry is NOT done here: the UI calls the existing
 * POST /api/documents/[id]/run-ocr (documents.edit), which only re-runs
 * passport OCR — hence the per-row `retryable` flag.
 * Gated by `automation.view` (system-health monitoring, like Automation).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("automation.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = ocrMonitorQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const q = parsed.data;

  const now = Date.now();
  const since24h = new Date(now - 24 * HOUR_MS);
  const since7d = new Date(now - 7 * 24 * HOUR_MS);

  const jobsWhere: Prisma.DocumentExtractionWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.extractionType ? { extractionType: q.extractionType } : {}),
  };

  try {
    const [allTime, last24h, last7d, failedAll, failed24h, failed7d, jobsTotal, jobs, failureRows] = await runSequentially([
      () => (countByStatus()),
      () => (countByStatus(since24h)),
      () => (countByStatus(since7d)),
      () => (countFailures()),
      () => (countFailures(since24h)),
      () => (countFailures(since7d)),
      () => (db.documentExtraction.count({ where: jobsWhere })),
      () => (db.documentExtraction.findMany({
        where: jobsWhere,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          extractionType: true,
          provider: true,
          status: true,
          mrzValid: true,
          createdAt: true,
          reviewedAt: true,
          documentId: true,
          bookingId: true,
          passengerId: true,
          document: { select: { type: true, fileUrl: true, passengerId: true, bookingId: true } },
        },
      })),
      () => (db.auditTrail.findMany({
        where: { action: "OCR_FAILED" },
        orderBy: { timestamp: "desc" },
        take: FAILURE_LIST_SIZE,
        select: { id: true, entityId: true, note: true, timestamp: true },
      }))]);

    // Failure rows point at a Document id; resolve those documents and
    // whether a later extraction for the same document has since succeeded.
    const failedDocumentIds = Array.from(new Set(failureRows.map((row) => row.entityId)));
    const [failedDocuments, laterExtractions] = await runSequentially([
      () => (failedDocumentIds.length
        ? db.document.findMany({
            where: { id: { in: failedDocumentIds } },
            select: { id: true, type: true, fileUrl: true, passengerId: true, bookingId: true },
          })
        : Promise.resolve([])),
      () => (failedDocumentIds.length
        ? db.documentExtraction.findMany({
            where: { documentId: { in: failedDocumentIds } },
            orderBy: { createdAt: "desc" },
            select: { documentId: true, createdAt: true },
          })
        : Promise.resolve([]))]);
    const documentById = new Map(failedDocuments.map((document) => [document.id, document]));
    const latestExtractionAt = new Map<string, Date>();
    for (const extraction of laterExtractions) {
      if (!latestExtractionAt.has(extraction.documentId)) latestExtractionAt.set(extraction.documentId, extraction.createdAt);
    }

    // Booking references + passenger names/customers for every row on screen.
    const bookingIds = new Set<string>();
    const passengerIds = new Set<string>();
    for (const job of jobs) {
      const bookingId = job.bookingId ?? job.document.bookingId;
      if (bookingId) bookingIds.add(bookingId);
      const passengerId = job.passengerId ?? job.document.passengerId;
      if (passengerId) passengerIds.add(passengerId);
    }
    for (const document of failedDocuments) {
      if (document.bookingId) bookingIds.add(document.bookingId);
      if (document.passengerId) passengerIds.add(document.passengerId);
    }
    const [bookings, passengers] = await runSequentially([
      () => (bookingIds.size
        ? db.booking.findMany({ where: { id: { in: Array.from(bookingIds) } }, select: { id: true, bookingId: true } })
        : Promise.resolve([])),
      () => (passengerIds.size
        ? db.passenger.findMany({ where: { id: { in: Array.from(passengerIds) } }, select: { id: true, fullName: true, customerId: true } })
        : Promise.resolve([]))]);
    const bookingRefById = new Map(bookings.map((booking) => [booking.id, booking.bookingId]));
    const passengerById = new Map(passengers.map((passenger) => [passenger.id, passenger]));

    function linkFor(bookingId: string | null, passengerId: string | null) {
      const passenger = passengerId ? passengerById.get(passengerId) : undefined;
      return {
        booking: bookingId ? { id: bookingId, reference: bookingRefById.get(bookingId) ?? bookingId } : null,
        passenger: passenger ? { id: passenger.id, name: passenger.fullName, customerId: passenger.customerId } : null,
      };
    }

    const jobItems = jobs.map((job) => ({
      id: job.id,
      extractionType: job.extractionType,
      provider: job.provider,
      status: job.status,
      mrzValid: job.mrzValid,
      createdAt: job.createdAt,
      reviewedAt: job.reviewedAt,
      documentId: job.documentId,
      documentType: job.document.type,
      // Client corrections 2026-10-05 — open the document straight from the monitor for manual review.
      documentFileUrl: job.document.fileUrl,
      ...linkFor(job.bookingId ?? job.document.bookingId, job.passengerId ?? job.document.passengerId),
      retryable: job.status === "REJECTED" && canRetryPassportOcr(job.document),
    }));

    const failures = failureRows.map((row) => {
      const document = documentById.get(row.entityId) ?? null;
      const lastSuccessAt = latestExtractionAt.get(row.entityId);
      return {
        id: row.id,
        documentId: row.entityId,
        documentType: document?.type ?? null,
        documentFileUrl: document?.fileUrl ?? null,
        note: row.note,
        timestamp: row.timestamp,
        resolved: Boolean(lastSuccessAt && lastSuccessAt > row.timestamp),
        ...linkFor(document?.bookingId ?? null, document?.passengerId ?? null),
        retryable: document ? canRetryPassportOcr(document) : false,
      };
    });

    return jsonSuccess({
      totals: {
        allTime: { ...allTime, extracted: allTime.PENDING_REVIEW + allTime.CONFIRMED + allTime.REJECTED, failed: failedAll },
        last24h: { ...last24h, extracted: last24h.PENDING_REVIEW + last24h.CONFIRMED + last24h.REJECTED, failed: failed24h },
        last7d: { ...last7d, extracted: last7d.PENDING_REVIEW + last7d.CONFIRMED + last7d.REJECTED, failed: failed7d },
      },
      jobs: { items: jobItems, total: jobsTotal, page: q.page, pageSize: q.pageSize },
      failures,
    });
  } catch (error) {
    console.error("[api/admin/ocr-monitor]", error);
    return jsonError(500, "Couldn't load OCR activity. Please try again.");
  }
}
