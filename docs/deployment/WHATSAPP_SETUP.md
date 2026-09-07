# WhatsApp Cloud API — setup

For the customer-facing explanation of what the bot actually does, see `WHATSAPP_JOURNEY.md` at the project root. This doc is the technical checklist to go from "placeholders in `.env`" to "actually live."

The app already runs the full bot pipeline in dev without any of this — `src/lib/whatsapp/get-gateway.ts` falls back to logging to the server console until `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_APP_SECRET` are real values, and `src/lib/whatsapp-bot/get-ai-provider.ts` falls back to rule-based keyword matching until `ANTHROPIC_API_KEY` is a real value. Nothing below is required to develop or test the bot logic itself.

## 1. Meta Business setup (the client's account, not ours)

1. The **client** needs a Meta Business Account and a WhatsApp Business Account linked to it, with a real phone number added (this cannot be automated — it's Meta's own verification flow).
2. Create a Meta App at [developers.facebook.com](https://developers.facebook.com/apps) with the **WhatsApp** product added.
3. Under **WhatsApp → API Setup** in the App Dashboard:
   - Note the **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - Generate a **permanent access token** — NOT the default 24-hour test token shown there. Create a **System User** (Business Settings → Users → System Users), assign it the WhatsApp app with `whatsapp_business_messaging` + `whatsapp_business_management` permissions, and generate its token with no expiry → `WHATSAPP_ACCESS_TOKEN`.
4. Under the App's **Basic Settings**, copy the **App Secret** → `WHATSAPP_APP_SECRET` (used to verify incoming webhook signatures — see `src/lib/whatsapp/cloud-api-gateway.ts`'s `verifyMetaSignature`).

## 2. Webhook registration

1. Deploy the app so `https://<your-domain>/api/webhooks/whatsapp` is publicly reachable.
2. In the Meta App Dashboard, under **WhatsApp → Configuration**, set the **Callback URL** to that address and the **Verify Token** to the exact value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env` (this value isn't issued by Meta — the app invents it; just make sure both sides have the identical string).
3. Click **Verify and Save** — Meta calls `GET /api/webhooks/whatsapp` with that token and expects the challenge echoed back (`src/app/api/webhooks/whatsapp/route.ts`'s `GET` handler does this).
4. Subscribe the app to the **messages** webhook field so inbound customer messages actually get delivered.

## 3. Configure the app

```
WHATSAPP_ACCESS_TOKEN="EAAxxxx..."              # the System User permanent token from step 1.3
WHATSAPP_PHONE_NUMBER_ID="123456789012345"      # from step 1.3
WHATSAPP_APP_SECRET="a1b2c3..."                 # from step 1.4
WHATSAPP_WEBHOOK_VERIFY_TOKEN="<same value used in step 2.2>"
```

Once all three of `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_APP_SECRET` are real, `getWhatsAppGateway()` automatically switches from the console fallback to the real Cloud API — no other code change.

## 4. Anthropic (Claude) — for real natural-language intent + FAQ answering

```
ANTHROPIC_API_KEY="sk-ant-..."     # from https://console.anthropic.com
```

Once this is set, `getAiProvider()` automatically switches from keyword matching to Claude for both intent classification and FAQ answering — see `src/lib/whatsapp-bot/claude-ai-provider.ts`. This is independent of the three WhatsApp variables above — either can be configured before the other.

## 5. Getting notification templates approved by Meta

The bot's own conversational replies (§3 of `WHATSAPP_JOURNEY.md`) need no Meta approval — they're all "session messages," sent within 24 hours of the customer's own message, which WhatsApp allows freely.

The separate proactive notifications (LEAD_RECEIVED, QUOTE_READY, etc. — configured in Admin → Notification Templates) are different: WhatsApp requires these to be pre-approved **Message Templates** whenever sent outside that 24h window. To get one live:

1. In Meta Business Manager → **WhatsApp Manager → Message Templates**, create a new template. Use the exact copy from the matching row in Admin → Notification Templates as your starting point (the `{{customerName}}` etc. placeholders become Meta's `{{1}}`, `{{2}}`... positional variables — Meta's UI walks you through this).
2. Submit for approval (usually minutes to a couple of days).
3. Once **approved**, copy its exact **template name** and **language code** (e.g. `en` or `en_US`) into that same event's row in Admin → Notification Templates (the "Meta Template Name" / "Meta Template Language" fields, shown only for WhatsApp templates).
4. Use the **Send Test** button on that template to confirm it actually sends before relying on it.

Until step 3 is done for a given event, `sendNotificationWhatsApp()` (`src/lib/notifications/send-notification-whatsapp.ts`) skips sending it — audited as `WHATSAPP_SKIPPED`, not attempted and not an error — since Meta would reject an unapproved template send anyway. The email notification for that same event is unaffected and keeps sending normally.

## 6. Verify it end-to-end

1. Message the TripNexio WhatsApp number from a real phone with something like "I need OTB" and walk through the conversation — confirm real replies arrive and, once complete, a real Lead shows up in `/crm/leads` with Source "WhatsApp Bot".
2. In Admin → Notification Templates, use **Send Test** on an approved WHATSAPP template to confirm the notification path works too.
3. Ask a question covered by an FAQ (Admin → FAQs) and confirm the bot answers it; ask something NOT covered and confirm it hands off instead of guessing.

## Known gap: no scheduler for time-based reminders

Same limitation as the email side (see `EMAIL_SETUP.md`) — `QUOTE_REMINDER` has a seeded template on both channels but no trigger, since nothing in this app runs independent of a request/webhook yet. Needs a real cron/scheduler once deployment infrastructure exists.
