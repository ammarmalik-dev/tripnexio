# TripNexio — How to set statuses and WhatsApp / email messages yourself

Everything below is done in **Admin**. Nothing needs a developer.

## 1. Status list of a service (names, customer wording, order)

Admin → Service Configuration → pick the service → **Statuses** tab.

- There are two lists: **Lead statuses** (before payment) and **Booking statuses** (after payment). Switch with the buttons at the top.
- Each status has:
  - **Name**: what staff see in the CRM, e.g. "On Hold".
  - **Customer-Safe Label**: what the customer sees on Track Status, the website and in messages, e.g. "Booking On Hold". Blank means the customer sees the Name.
  - **Display Order**: its position in the list.
  - **Maps to Lead / Booking Status**: the overall stage the CRM lists and reports use (New, Processing, Completed, Cancelled…).
  - **Moved here automatically on**: the system event that moves a booking here by itself, e.g. "Payment received" → Paid, "Refund completed" → Refund Completed. Leave it blank for a status staff choose by hand.
  - **Notify customer with**: the message (email + WhatsApp) sent when a booking reaches this status. Blank means no message.
  - **Terminal**: a final status; nothing moves on from it, except a refund.
  - **Blocks refund**: tick it once the request has gone to the embassy / airline. A refund then needs Admin.
- Disable a status instead of deleting it; old bookings keep their history.

## 2. Restrictions: which status can follow which

Same screen. Under each status, **Transitions to** lists where staff may move it next.

- Add one with the **Add transition to…** dropdown; remove one with its **×**.
- In the CRM / Admin record, the status card is on the **right**: the current internal status, what the customer sees, and a **Move to** list with only the allowed next statuses (✉ = the customer gets an email + WhatsApp).
- **Statuses with an action move by themselves** and are not in the Move to list:
  - payment received
  - quotation sent / approved / expired
  - documents requested, uploaded, validated, rejected, additional documents
  - visa / ticket / package delivered
  - passenger results (partial approval)
  - refunds
  - each service's Operations panel: New Visa Embassy steps, OTB "Sent to Airlines" / Approved / Rejected, Return Ticket "Sent to Airlines", Special Fare confirmation / seat unavailable, Visa Change exit / embassy steps, Visa Extension outcome
- Staff pick by hand only the statuses with no action: On Hold, Cancellation Requested / Cancelled, User Not Responding, Unable to Process and similar.
- Built-in rules always apply on top:
  - no going back a stage, and no leaving a final status (except for a refund)
  - no skipping: nothing after "Sent to Airlines" / "Applied to Embassy" (approved, ticket issued, additional documents, partial approval, rejection) before the booking reaches it
  - documents must be validated before "Documents Validated" and before sending to the airline / embassy
  - refund statuses (Refund Pending / Completed, Partially Cancelled, Cancelled and Refunded) come only from a raised and approved refund
  - after a partial refund the booking stays "Partially Cancelled"; the remaining passengers can only move forward
- Only an **Admin** (full access) can move a booking to any status ("Admin override…"). This needs a reason and is written to the audit log.

## 3. The messages (email + WhatsApp)

Admin → System Settings → **Notification Templates**.

- Every message is one row per **Event** and **Channel** (EMAIL or WHATSAPP). The event name is the one picked in "Notify customer with" on the status.
- Each row has:
  - **Subject**: email only.
  - **Email heading**: optional.
  - **Message Body**: the text. Variables in `{{double braces}}` are filled in for you: `{{customer_name}}`, `{{booking_id}}`, `{{country_name}}`, `{{passenger_names}}`, `{{required_documents}}` and so on. Keep the variable names exactly as they are.
  - **Button text** / **Button opens**: the button under the message, e.g. "Upload Documents" → `secure_upload_link`. The links always open the customer's own booking page, never a blank Track page.
  - **Meta Template Name / Language** (WhatsApp only): see section 4.
- Use **Send Test** on a row to send it to your own email or WhatsApp number first.
- The list is grouped by service (New Visa, Visa Extension, Visa Change, Special Fare, Return Ticket, OTB, General / system). Old messages that are never sent any more are **retired** and hidden; tick **Show retired templates** to see them.
- To turn a message off, press **Retire** on its row.
- The "request received" message is the same on the website screen, in the email and on WhatsApp: it comes from the service's first status template (e.g. NV_COUNTRY_REQUEST_PAYMENT_PENDING, VC_NEW, OTB_01_NEW). Edit it there.

## 4. WhatsApp outside the 24-hour window (Meta templates)

WhatsApp only lets a business send free text within 24 hours of the customer's last message. After that, only a **Meta-approved template** can be sent.

1. In Meta Business Manager → WhatsApp Manager → Message templates, create the template:
   - Category: **Utility**. Language: **English (en)**.
   - Body: the same as our WhatsApp row, with `{{1}}`, `{{2}}`… in the same order as our variables (the list we sent: `META_WHATSAPP_TEMPLATES_20OCT.md`).
   - Button: **Visit website**, URL type **Dynamic**, URL `https://tripnexio.com/{{1}}`.
2. When Meta approves it, paste its exact name into **Meta Template Name** on our WhatsApp row (language `en`).
3. Until then, the WhatsApp message still reaches customers who wrote to us in the last 24 hours. Email always goes.

**The button URL must be the dynamic `https://tripnexio.com/{{1}}`.** A fixed URL such as `https://tripnexio.com/track` makes every button open the Track page.

## 5. Quick checklist for a new status

1. Statuses tab: add the status (Name, Customer-Safe Label, order, Maps to, Notify customer with).
2. Add it to the **Transitions to** of the statuses before it, and add its own next statuses.
3. Notification Templates: check that the EMAIL and WHATSAPP rows for its event read correctly, then Send Test.
4. In Meta: submit the WhatsApp template, then paste the approved name.
