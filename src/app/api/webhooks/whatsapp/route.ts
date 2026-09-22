import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWhatsAppGateway } from "@/lib/whatsapp/get-gateway";
import { handleInboundMessage } from "@/lib/whatsapp-bot/engine";

interface CloudApiWebhookPayload {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        messages?: {
          from: string;
          type: string;
          text?: { body: string };
          /** Present when the customer tapped a row in an interactive list menu (see src/lib/whatsapp-bot/menu.ts). */
          interactive?: { type: string; list_reply?: { id: string; title: string }; button_reply?: { id: string; title: string } };
        }[];
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
  if (!message) {
    // Status callbacks (delivered/read receipts) — nothing for the bot to do.
    return new Response("OK", { status: 200 });
  }

  // A tapped menu row: the engine reads the row id (e.g. "MENU_NEW_VISA")
  // exactly like typed text (see engine.ts's tappedService check), so the
  // rest of this route doesn't need to know taps exist. The row's own
  // TITLE (not the raw id) is what gets logged, so the WhatsAppMessageLog
  // transcript reads naturally ("New Visa" rather than "MENU_NEW_VISA").
  const interactiveReply = message.type === "interactive" ? (message.interactive?.list_reply ?? message.interactive?.button_reply) : null;
  const text = interactiveReply?.id ?? message.text?.body;
  if (!text) {
    // Non-text, non-interactive message types (image, location, etc.) — nothing for the bot to do.
    return new Response("OK", { status: 200 });
  }
  const loggedText = interactiveReply?.title ?? text;

  const waId = message.from;
  const profileName = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name ?? null;

  await db.whatsAppMessageLog.create({ data: { waId, direction: "INBOUND", body: loggedText } });

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
    if (result.replyMenu) {
      await gateway.sendInteractiveList(waId, result.replyMenu);
    } else {
      await gateway.sendSessionText(waId, result.replyText);
    }
  } catch (error) {
    // The reply failed to actually deliver, but the conversation state is
    // already saved — log and move on rather than throwing, since Meta
    // would otherwise retry-redeliver the ORIGINAL inbound message.
    console.error("[whatsapp-webhook] failed to send reply", error);
  }

  return new Response("OK", { status: 200 });
}
