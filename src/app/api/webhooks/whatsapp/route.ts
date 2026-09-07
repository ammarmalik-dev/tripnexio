import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWhatsAppGateway } from "@/lib/whatsapp/get-gateway";
import { handleInboundMessage } from "@/lib/whatsapp-bot/engine";

interface CloudApiWebhookPayload {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        messages?: { from: string; type: string; text?: { body: string } }[];
        contacts?: { profile?: { name?: string } }[];
      };
    }[];
  }[];
}

/**
 * Meta's webhook verification handshake — required once, when the webhook
 * URL is first registered in the Meta App Dashboard. Meta calls this with
 * hub.mode=subscribe and a hub.verify_token it expects to match
 * WHATSAPP_WEBHOOK_VERIFY_TOKEN exactly; on a match, echo back hub.challenge
 * as plain text. See docs/deployment/WHATSAPP_SETUP.md.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Public route — no staff session, Meta calls this directly. Authenticity
 * comes from the HMAC signature check inside gateway.verifyWebhookSignature
 * (X-Hub-Signature-256), same raw-body-first pattern as the Razorpay
 * webhook. Always responds 200 once the payload is understood (even if the
 * bot's own reply-send fails) — Meta retries on non-2xx, and a message
 * that's already been processed shouldn't be reprocessed on redelivery.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const gateway = getWhatsAppGateway();
  if (!gateway.verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: CloudApiWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== "text" || !message.text?.body) {
    // Status callbacks (delivered/read receipts), non-text messages, etc. — nothing for the bot to do.
    return new Response("OK", { status: 200 });
  }

  const waId = message.from;
  const profileName = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name ?? null;
  const text = message.text.body;

  await db.whatsAppMessageLog.create({ data: { waId, direction: "INBOUND", body: text } });

  const conversation = await db.whatsAppConversation.upsert({
    where: { waId },
    update: { lastInboundAt: new Date(), ...(profileName ? { customerName: profileName } : {}) },
    create: { waId, customerName: profileName, lastInboundAt: new Date() },
  });

  const result = await handleInboundMessage(conversation, text, profileName);

  await db.whatsAppConversation.update({
    where: { waId },
    data: { state: result.nextState, serviceType: result.nextServiceType, collectedFields: result.nextCollectedFields },
  });

  await db.whatsAppMessageLog.create({ data: { waId, direction: "OUTBOUND", body: result.replyText } });

  try {
    await gateway.sendSessionText(waId, result.replyText);
  } catch (error) {
    // The reply failed to actually deliver, but the conversation state is
    // already saved — log and move on rather than throwing, since Meta
    // would otherwise retry-redeliver the ORIGINAL inbound message.
    console.error("[whatsapp-webhook] failed to send reply", error);
  }

  return new Response("OK", { status: 200 });
}
