import type { NextRequest } from "next/server";
import { supportRequestSchema } from "@/lib/validation/support-request-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getStaffSession } from "@/lib/auth/staff-session";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";
import { checkBase64Upload } from "@/lib/uploads/validate-upload";
import { createSupportTicket } from "@/lib/support/tickets";
import { describeError } from "@/lib/api/describe-error";

/**
 * P22 item 2 — CRM Help page "Report an issue". Client doc 16 Nov (L3): it now raises a help desk ticket (TNIT0001…)
 * with optional screenshots / files, emails the person who raised it and alerts Admin. Any signed-in staff member.
 */
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  if (await isRateLimited(`support-request:${session.id}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return jsonError(429, "You've reported several issues recently. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = supportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const { title, description, pageUrl, priority, attachments = [] } = parsed.data;

  try {
    // Every file is checked (type from the bytes, 8MB) before anything is stored.
    for (const file of attachments) {
      const check = checkBase64Upload(file.data);
      if (!check.ok) return jsonError(check.status, `${file.fileName}: ${check.message}`, { attachments: [check.message] });
    }
    const stored = [];
    for (const file of attachments) {
      const check = checkBase64Upload(file.data);
      if (!check.ok) continue;
      const { url } = await saveUploadedFile(file.data);
      stored.push({ fileName: file.fileName, fileUrl: url, mimeType: check.mimeType, sizeBytes: check.buffer.length });
    }
    const ticket = await createSupportTicket({ id: session.id, name: session.name }, { title, description, pageUrl, priority, attachments: stored });
    return jsonSuccess({ id: ticket.id, ticketNumber: ticket.ticketNumber }, 201);
  } catch (error) {
    if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
    console.error("[support-requests] create failed", describeError(error));
    return jsonError(500, "Couldn't submit your report. Please try again.");
  }
}
