# TripNexio: drafts for client approval (2026-10-12)

Two drafts the client asked to approve or edit:
- **Part A:** standard Terms & Conditions points for each service (checklist item B10).
- **Part B:** WhatsApp message templates to submit in Meta WhatsApp Manager (checklist item I2).

Everything below is a DRAFT. Please edit any line freely. After approval, the T&C text goes into Admin → Service Configuration → Terms, and the approved Meta template names go into Admin → Notification Templates.

---

## Part A: Standard T&C points (DRAFT)

### Points for every service
1. TripNexio is a service facilitator. The final decision on a visa, OTB, extension or ticket is made by the embassy, immigration authority or airline, not by TripNexio.
2. Processing times are estimates. Delays caused by the embassy, immigration, airline, public holidays or missing documents are outside our control.
3. The customer is responsible for giving correct details (name exactly as in the passport, passport number, dates). Any cost from wrong details is paid by the customer.
4. The passport must be valid for at least 6 months from the travel date.
5. Government, embassy, airline and vendor fees are non-refundable once they have been paid to the authority or vendor.
6. Refunds follow the refund policy of each service. An approved refund goes back to the original payment method.
7. Documents are stored securely and deleted automatically after the retention period.
8. Carry the original passport and a valid government photo ID while travelling.

### New Visa
1. Approval or rejection is decided only by the immigration authority. The service fee is not refunded after the visa has been applied.
2. Express processing makes our processing faster. It does not guarantee approval or an earlier decision from immigration.
3. If immigration asks for extra documents, they must be shared quickly. Delays in sharing them can delay the visa.
4. Check every detail on the visa copy as soon as you receive it, and tell us at once about any mistake.
5. Entering the country is decided by immigration at the airport, even with an approved visa.

### Visa Extension
1. The request must reach us before the 6:00 PM cut-off on a working day to be processed the same day.
2. Overstay fines up to the date of application are paid by the customer.
3. The customer must stay inside the country until the extension is approved.
4. A rejected extension is not refunded once it has been applied with immigration.

### Visa Change (Airport-to-Airport / Border Exit & Re-entry)
1. Follow the flight timings and instructions in the package exactly. Missing the exit or re-entry flight, or the border vehicle, may cancel the package.
2. Re-entry depends on the new visa being approved. Any wait for approval is part of the process.
3. Fines and overstay charges before the exit are paid by the customer.
4. Carry the original passport, the current visa copy and the new visa copy (once issued) at all times.
5. The package price covers only the items listed under Inclusions.

### Flight Special Fare
1. Special fares are limited and confirmed only after payment, subject to seat availability with the airline.
2. Every passenger must carry the original passport or a valid government photo ID matching the ticket name.
3. Reach the airport at least 3 hours before an international flight and 2 hours before a domestic flight, or as advised by the airline.
4. Baggage allowance, date changes and cancellations follow the airline's fare rules shown on the quotation.
5. Name changes are not allowed after the ticket is issued.
6. If the fare is unavailable after payment, we offer the alternative route or a refund as per policy.

### Return Verified Ticket
1. The return ticket is a verifiable reservation for visa or immigration purposes. It is not a confirmed travel ticket unless stated.
2. The reservation is valid for a limited time set by the airline.
3. A cancellation fee applies as per destination before the reservation is forwarded. No refund after it has been forwarded.
4. Acceptance by immigration or an airline is not guaranteed.

### OTB (OK to Board)
1. OTB approval is decided only by the airline. The fee is not refunded if the airline rejects the OTB.
2. Submit the OTB request at least 48 hours before departure. Urgent requests are processed on a best-effort basis.
3. The visa and passport details must match the airline booking exactly.
4. If we are unable to process the request, the full amount is refunded.

> Please confirm or correct the airport reporting times (Special Fare point 3) and the OTB 48-hour lead time (OTB point 2). These are common industry practice, not values from TripNexio's own policy.

---

## Part B: WhatsApp message templates for Meta (DRAFT)

**How to submit:** WhatsApp Manager → Message Templates → Create template.
- Category: **Utility**.
- Language: **English** (`en`).
- Name: exactly as written below.
- Variables: `{{1}}`, `{{2}}` … in the same order as shown.
- Meta needs a sample value for each variable. Use the samples given.

After Meta approves a template, send us its name. We enter it in Admin so the message also goes out after the 24-hour window. The text must stay exactly as approved.

| # | Template name | Message text | Sample values |
|---|---|---|---|
| 1 | `tn_request_received` | Hi {{1}}, {{2}} Your reference: {{3}}. | 1 Rahul · 2 Your New Visa request has been received. Our team will review the details and get in touch shortly. · 3 11026VI001 |
| 2 | `tn_quote_ready` | Hi {{1}}, your quote for {{2}} is ready: {{3}} (valid until {{4}}). Review and pay here: {{5}} | 1 Rahul · 2 11026VC004 · 3 Rs. 25,000.00 · 4 12 Oct, 6:30 pm · 5 https://tripnexio.com/quote/abc123 |
| 3 | `tn_quote_reminder` | Hi {{1}}, your quote for {{2}} is expiring soon. Let us know if you'd like to proceed. | 1 Rahul · 2 11026VC004 |
| 4 | `tn_quote_expired` | Hi {{1}}, your quote for {{2}} has expired. Message us for an updated quote. | 1 Rahul · 2 11026VC004 |
| 5 | `tn_payment_link` | Hi {{1}}, your {{2}} booking is created. Booking ID: {{3}}. Amount: {{4}}. Complete your payment here: {{5}} (valid until {{6}}). After payment you can upload your documents on the same page. — Team TripNexio | 1 Rahul · 2 Return Ticket · 3 11026RT043 · 4 Rs. 3,000.00 · 5 https://tripnexio.com/pay/abc123 · 6 12 Oct, 06:30 pm |
| 6 | `tn_payment_received` | Hi {{1}}, we've received your payment of {{2}} for booking {{3}}. Thank you for choosing TripNexio! | 1 Rahul · 2 Rs. 1,605.00 · 3 11026OT002 |
| 7 | `tn_payment_reminder` | Hi {{1}}, your payment of {{2}} for booking {{3}} is still pending. Let us know if you need help completing it. | 1 Rahul · 2 Rs. 1,605.00 · 3 11026OT002 |
| 8 | `tn_refund_update` | Hi {{1}}, your refund of {{2}} for {{3}} booking {{4}} {{5}}. — Team TripNexio | 1 Rahul · 2 Rs. 3,000.00 · 3 Return Ticket · 4 11026RT043 · 5 has been approved and sent to the payment gateway |
| 9 | `tn_documents_required` | Hi {{1}}, we need {{2}} to proceed with {{3}}. Please share it at your earliest convenience. | 1 Rahul · 2 Bank statement · 3 11026VI001 |
| 10 | `tn_document_approved` | Hi {{1}}, your {{2}} for {{3}} has been verified. 👍 | 1 Rahul · 2 Passport · 3 11026VI001 |
| 11 | `tn_document_rejected` | Hi {{1}}, your {{2}} for {{3}} couldn't be verified. Please resubmit a clear copy. | 1 Rahul · 2 Passport · 3 11026VI001 |
| 12 | `tn_lead_followup` | Hi {{1}}, just checking in on your {{2}} request ({{3}}) — let us know if you'd like to proceed. | 1 Rahul · 2 New Visa · 3 11026VI001 |
| 13 | `tn_visa_extension_reminder` | Hi {{1}}, your extended UAE visa (booking {{2}}) is valid until {{3}}. Need a further extension? Just let us know. | 1 Rahul · 2 11026VE003 · 3 30 Oct 2026 |
| 14 | `tn_otb_approved` | Hi {{1}}, your OTB has been approved by the airline. OTB PNR / reference: {{2}} (booking {{3}}). Have a safe journey! — Team TripNexio | 1 Rahul · 2 ABC123 · 3 11026OT001 |
| 15 | `tn_status_update` | Hi {{1}}, the status of your booking {{2}} is now: {{3}}. Track it anytime on tripnexio.com/track. — Team TripNexio | 1 Rahul · 2 11026VI001 · 3 Applied to Embassy |
| 16 | `tn_output_delivered` | Hi {{1}}, your {{2}} for booking {{3}} is ready. Download it here: {{4}} — Team TripNexio | 1 Rahul · 2 Visa · 3 11026VI001 · 4 https://tripnexio.com/account |
| 17 | `tn_coupon_offer` | Hi {{1}}, your request {{2}} isn't completed yet. If you'd still like to go ahead, coupon {{3}} gives {{4}} off this request, valid until {{5}}. Single use, for this request only. | 1 Rahul · 2 11026VC004 · 3 TNAQ7K2P · 4 10% (up to Rs. 500.00) · 5 15 Oct 2026 |

**Notes for the developer (applied in Admin once the templates are approved):**
- Templates 1–13 and 17 are the same text as the current WhatsApp bodies, so only the Meta name has to be entered in Admin.
- Template 14 drops the trailing Return Ticket offer, because Meta rejects a template that ends with a variable or gets an empty value. The OTB_APPROVED WhatsApp body in Admin must be updated to the exact text above.
- Templates 15 (SERVICE_STATUS_UPDATE) and 16 (OUTPUT_DELIVERED) need new WhatsApp rows in Admin with the exact text above.
- The variable order of the Admin body sets the `{{1}}, {{2}}…` order. Admin body and Meta text must match exactly.
- Template 17 can be skipped if the client doesn't use abandoned-quote coupons.
