# TripNexio WhatsApp Journey

This explains, in plain terms, what happens when a customer messages TripNexio on WhatsApp — how the bot figures out what they want, how it collects the details, how it answers questions, and when it hands off to a real person. It's written for the TripNexio team, not developers; the technical implementation lives in `src/lib/whatsapp-bot/` and `src/lib/whatsapp/` if a developer needs it.

## 1. Entry — a customer sends a message

Every TripNexio WhatsApp conversation starts the same way: a customer sends any message to the TripNexio WhatsApp number. There's no menu they have to press first — they can type in plain English, Hindi, or a mix of both (**Hinglish**), for example:

- "I need a new visa"
- "mera visa extend karna hai" (*I need to extend my visa*)
- "What documents do I need for OTB?"
- "agent" (to skip straight to a human)

The bot remembers where each customer is in their conversation (which service they're requesting, what's already been answered) between messages, so they never have to repeat themselves mid-conversation. If a customer goes quiet and comes back days later after finishing a request, the bot treats their next message as the start of a fresh conversation.

At any point, a customer can type **"menu"**, **"restart"**, or **"hi"** to go back to the beginning — useful if they change their mind partway through, or want to submit a second request right after finishing their first one.

## 2. Intent detection — figuring out what they want

The very first thing the bot does with a new message is work out the customer's **intent** — is this the start of a service request, a question, or a request to talk to a person? It recognizes:

| Intent | Example |
|---|---|
| New Visa | "I need a tourist visa", "visa chahiye" |
| Visa Extension | "mera visa extend karna hai" |
| Visa Change | "I need to change my visa status", "border exit" |
| Flight Special Fare | "I need a cheap flight", "book flight ticket" |
| Return Verified Ticket | "I need a return ticket" |
| OTB (Ok to Board) | "I need OTB", "ok to board" |
| A question | "How long does OTB take?", "What is a visa extension?" |
| Talk to a human | "agent", "talk to someone" |

Once a service is detected, the bot starts asking for the details it needs, one question at a time (see §3). If the message reads as a question instead (it has a "?", or starts with a question word like "what"/"how"/"kya"/"kaise"), the bot tries to answer it from the FAQ knowledge base instead of starting a request (see §4) — so "How long does OTB take?" is answered as a question, not misread as a request to start an OTB booking.

**How this actually works today, and what changes once real AI is turned on:** Out of the box, this runs on a rule-based keyword matcher — a curated list of English and Hinglish phrases per service (exactly the kind of phrases in the table above). It's reliable for phrasing close to those examples but won't understand every possible way a customer might phrase something. Once the team provides an Anthropic (Claude) API key, intent detection automatically switches to actually understanding free-form natural language — no code change needed, just adding the key. Until then, the keyword matcher is what's live.

## 3. Service routing — collecting the details

Once the bot knows which service the customer wants, it asks for exactly the information TripNexio's team needs to work the request — the same information the website's own request forms ask for, just one question at a time instead of a form. For example, for a New Visa request, the bot asks (in order): full name, email, destination country, visa type, number of travelers, travel date, and processing type (normal/urgent) — each as its own WhatsApp message, with numbered options where there's a fixed list to choose from (e.g. "1. United Arab Emirates, 2. Saudi Arabia, ...").

The customer's WhatsApp number is used as their mobile number automatically — they're never asked for it.

If a customer's answer doesn't make sense (an invalid date, a number outside the allowed range, an out-of-range option), the bot explains what's wrong and asks the same question again — it never silently accepts something bad.

Once every question is answered, the bot creates the request in TripNexio's system **exactly the same way a website submission does** — same validation, same customer/passenger matching (a returning customer's existing record is reused, not duplicated), same reference number format, same audit trail. The bot then confirms the reference number to the customer and lets them know the team will follow up — from that point on, it's a normal Lead in the CRM, indistinguishable from one submitted through the website, except its "Source" is recorded as WhatsApp so the team can see where it came from.

## 4. FAQ answering — questions only, never guesses

For anything that reads as a question rather than a service request, the bot looks it up against the **FAQ knowledge base the team manages in Admin → FAQs** — nothing else. This is a hard rule: if the FAQ content doesn't clearly cover what was asked, the bot says so and hands off to a human (§5) instead of guessing or making something up. It will never invent visa rules, prices, processing times, or anything else that isn't explicitly written in an FAQ answer.

Same as intent detection: today this runs on a keyword-matching fallback (finds the FAQ whose question text best overlaps with what was asked, and returns that FAQ's answer word-for-word). Once a Claude API key is added, this switches to genuinely understanding the question and phrasing a natural answer — strictly still sourced only from the FAQ content, with the same "don't know → hand off" rule enforced either way.

**This means keeping the FAQ knowledge base current in Admin → FAQs directly controls what the bot can answer.** An unanswered-but-common question is a sign to add an FAQ for it, not a bot bug.

## 5. Human handoff — when the bot steps back

The bot hands the conversation off to the TripNexio support team (and stops trying to handle it automatically) whenever:

- The customer explicitly asks for a human ("agent", "talk to someone", etc.)
- A question isn't confidently answered by the FAQ knowledge base
- Something the bot can't recover from goes wrong (e.g. a request for a service that has no options configured, or an unexpected system error)

When that happens, the bot sends the customer TripNexio's phone number, email, and WhatsApp contact so they're never left stuck, and every message in that conversation stays logged (see below) so a team member picking it up can see everything the customer already said. A customer can always get themselves back into the automated flow at any time by typing "menu".

## 6. Everything is logged

Every inbound and outbound WhatsApp message is saved (visible to developers via the `WhatsAppMessageLog` table today; a dedicated CRM inbox screen is a natural next step — see the project's next-steps list). Every Lead the bot creates, and every automated notification sent, is recorded in the same audit trail the rest of the CRM uses, so nothing the bot does is invisible to the team.

## 7. Automated notifications on WhatsApp

Beyond the conversational bot, TripNexio's WhatsApp number also sends automatic status updates for the same events the team already gets by email: request received, quote ready, quote expired, payment received, documents required, and document approved/rejected. These are configured in **Admin → Notification Templates**, same screen as the email versions.

**Important distinction from the bot's own replies:** WhatsApp has a rule that a business can only message a customer freely for 24 hours after that customer's last message. Outside that window — which covers most of these automatic notifications, since a customer who submitted a request on the website hasn't necessarily messaged WhatsApp at all — WhatsApp requires the message to use a **template Meta has pre-approved**, not just any text. Practically, this means:

1. The team writes the notification copy in Admin → Notification Templates (already done, with placeholder sample copy).
2. That exact copy gets submitted to Meta for approval as an official "Message Template" (a one-time setup step per event — see `docs/deployment/WHATSAPP_SETUP.md`).
3. Once Meta approves it, the approved template's name gets pasted into the same Admin screen.
4. From that point on, the notification actually sends on WhatsApp automatically.

Until step 3 is done for a given event, that event's WhatsApp notification is skipped (not sent, not an error) — the email version still goes out as normal. Admin → Notification Templates shows exactly which events still need this, and has a "Send Test" button to confirm a template works once approved.

## Known limitation: no proactive reminders yet

"Quote expiring soon" reminders (sent *before* a quote lapses, as opposed to *when* it lapses) aren't live yet — sending something on a schedule, independent of a customer message, needs a background job/scheduler that doesn't exist in this app yet. This is a known gap, not an oversight — see `docs/deployment/WHATSAPP_SETUP.md` and `docs/deployment/EMAIL_SETUP.md` for the same limitation on the email side.
