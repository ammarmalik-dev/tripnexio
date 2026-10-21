# WhatsApp templates to submit to Meta (client doc 2026-10-20, O7)

121 templates. Submit each in Meta Business Manager → WhatsApp Manager → Message templates, category **Utility**, language **English (en)**, with the exact name, body and button below. Once Meta approves one, open Admin → System Settings → Notification Templates → that event (WhatsApp) and paste the same name into "Meta template name" (language `en`). Until then, WhatsApp messages still go out as normal messages to customers who messaged us in the last 24 hours; email always goes.

The same list as a spreadsheet: `META_WHATSAPP_TEMPLATES_20OCT.csv`.

**How to fill the Meta form (checked with the first template, 21 Oct):**
1. Category **Utility** → **Default** (not Order Details / Order Status / Flows).
2. Name = exact name below, language English, **Type of variable: Number**, media None, header empty.
3. Body = the text below exactly, no quote marks. Each variable appears only once (Meta rejects a repeated variable).
4. Variable samples = the "Sample values" below, in the same order.
5. Footer "Thanks" is fine (optional).
6. Button: Visit website → button text below → URL type **Dynamic** → Website URL **only** `https://tripnexio.com/` (Meta adds {{1}} itself) → Sample URL `https://tripnexio.com/track`.
7. Message validity period: ON, 12 hours.


## New Visa

### `nv_country_request_payment_pending_wa`
- Event: `NV_COUNTRY_REQUEST_PAYMENT_PENDING`
- Variables: {{1}} = customer_name, {{2}} = country_name, {{3}} = application_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = United Arab Emirates, {{3}} = 11026VI001
- Button: URL button "Complete Payment" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Thanks for choosing TripNexio!

Your New Visa {{2}} request has been received. Please complete your payment to proceed.

Application ID: {{3}}

If you have already paid, please disregard this message.
```

### `nv_payment_received_wa`
- Event: `NV_PAYMENT_RECEIVED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = passenger_count
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Passenger Count
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Thanks for choosing TripNexio! Your New Visa Payment has been received.
Booking ID: {{2}}
Country: {{3}}
Passengers: {{4}}
We'll update you when there is a next step.
```

### `nv_user_not_responding_wa`
- Event: `NV_USER_NOT_RESPONDING`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}}, we're waiting for your response to continue your New Visa request.
Booking ID: {{2}}
Country: {{3}}
Please review your booking and respond when you can.
```

### `nv_documents_upload_wa`
- Event: `NV_DOCUMENTS_PENDING`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = passenger_name, {{5}} = required_documents
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Passenger Name, {{5}} = Required Documents
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Please upload the following required documents for your New Visa booking:
Booking ID: {{2}}
Country: {{3}}
Passenger: {{4}}
Please upload: {{5}}
```

### `nv_documents_required_wa`
- Event: `NV_DOCUMENTS_REQUIRED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = passenger_name, {{5}} = required_documents
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Passenger Name, {{5}} = Required Documents
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

The following documents are missing or need correction for your New Visa booking:
Booking ID: {{2}}
Country: {{3}}
Passenger: {{4}}
Please upload/correct: {{5}}
```

### `nv_documents_validated_wa`
- Event: `NV_DOCUMENTS_VALIDATED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your documents have been validated for booking {{2}} ({{3}}). This is not visa approval. We'll update you on the next stage.
```

### `nv_applied_to_embassy_wa`
- Event: `NV_APPLIED_TO_EMBASSY`
- Variables: {{1}} = customer_name, {{2}} = country_name, {{3}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = United Arab Emirates, {{3}} = 11026VI001
- Button: URL button "Track Application" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your visa application for {{2}} has been submitted to the relevant embassy/authority.
Booking ID: {{3}}
We'll update you when more information is available.
```

### `nv_additional_documents_required_wa`
- Event: `NV_ADDITIONAL_DOCUMENTS_REQUIRED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = passenger_name, {{5}} = required_documents, {{6}} = additional_document_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Passenger Name, {{5}} = Required Documents, {{6}} = Additional Document Reason
- Button: URL button "Submit Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

The embassy/immigration authority has requested the following additional documents for your New Visa application:
Booking ID: {{2}}
Country: {{3}}
Passenger: {{4}}
Required: {{5}}
Reason: {{6}}
```

### `nv_additional_documents_submitted_wa`
- Event: `NV_ADDITIONAL_DOCUMENTS_SUBMITTED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = passenger_name, {{5}} = required_documents
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Passenger Name, {{5}} = Required Documents
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received the additional documents for booking {{2}}.
Country: {{3}}
Passenger: {{4}}
Submitted: {{5}}
Our team will validate them.
```

### `nv_partial_approval_wa`
- Event: `NV_PARTIAL_APPROVAL`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = approved_passenger_names, {{5}} = other_passenger_outcomes
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Approved Passenger Names, {{5}} = Other Passenger Outcomes
- Button: URL button "Download Visa" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa approval update for booking {{2}} ({{3}}).
Approved passenger(s): {{4}}
Other outcomes: {{5}}

You can also download available visa files from your TripNexio account.
```

### `nv_visa_approved_wa`
- Event: `NV_VISA_APPROVED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = approved_passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Approved Passenger Names
- Button: URL button "Download Visa" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Good news! Your visa is approved.
Booking ID: {{2}}
Country: {{3}}
Passenger(s): {{4}}

You can also download it from your TripNexio account.
Please verify it against the passport and report any spelling, visa type or other discrepancy within 24 hours. Full travel instructions and disclaimer are in your email.
```

### `nv_visa_rejected_wa`
- Event: `NV_VISA_REJECTED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = rejected_passenger_names, {{5}} = rejection_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Rejected Passenger Names, {{5}} = Rejection Reason
- Button: URL button "View Details" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa application decision for booking {{2}} ({{3}}).
Rejected passenger(s): {{4}}
Reason: {{5}}
Please contact TripNexio support if you need assistance.
```

### `nv_on_hold_wa`
- Event: `NV_ON_HOLD`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = hold_reason, {{5}} = hold_next_action
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Hold Reason, {{5}} = Hold Next Action
- Button: URL button "View Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your New Visa application is on hold.
Booking ID: {{2}}
Country: {{3}}
Reason: {{4}}
Next step: {{5}}
```

### `nv_cancellation_requested_wa`
- Event: `NV_CANCELLATION_REQUESTED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = cancellation_passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Cancellation Passenger Names
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received your cancellation request for booking {{2}}.
Country: {{3}}
Passenger(s): {{4}}
Cancellation is under review. If approved, any eligible refund will follow the applicable refund policy and approval.
```

### `nv_partial_cancellation_wa`
- Event: `NV_PARTIAL_CANCELLATION`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = cancelled_passenger_names, {{5}} = other_passenger_outcomes
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Cancelled Passenger Names, {{5}} = Other Passenger Outcomes
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Partial cancellation confirmed for booking {{2}}.
Country: {{3}}
Cancelled passenger(s): {{4}}
Other outcomes: {{5}}
Any eligible refund is subject to refund policy and approval.
```

### `nv_cancelled_wa`
- Event: `NV_CANCELLED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = cancelled_passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Cancelled Passenger Names
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your New Visa booking {{2}} has been cancelled.
Country: {{3}}
Cancelled passenger(s): {{4}}
Any eligible refund will be processed according to the applicable refund policy and approval.
```

### `nv_refund_completed_wa`
- Event: `NV_REFUND_COMPLETED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = refund_id, {{4}} = refund_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = RF-1A2B3C4D, {{4}} = ₹2,500
- Button: URL button "View Refund Details" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your refund has been processed.
Booking ID: {{2}}
Refund ID: {{3}}
Amount: {{4}}
The amount is expected to reach your original payment source within 5–7 working days, depending on your bank/payment provider.
```


## Visa Change

### `vc_new_wa`
- Event: `VC_NEW`
- Variables: {{1}} = customer_name, {{2}} = application_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Thanks for choosing TripNexio! We've received your Visa Change request. Application ID: {{2}}. Our team will review it and update you when your quotation is ready.
```

### `vc_quotation_sent_wa`
- Event: `VC_QUOTATION_SENT`
- Variables: {{1}} = customer_name, {{2}} = application_id, {{3}} = quotation_id, {{4}} = currency, {{5}} = total_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Quotation Id, {{4}} = Currency, {{5}} = Total Amount
- Button: URL button "Review Quotation" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your Visa Change quotation is ready. Application ID: {{2}}. Reference: {{3}}. Total: {{4}} {{5}}. Please review the package, charges, validity and refund terms.
```

### `vc_quotation_approved_wa`
- Event: `VC_QUOTATION_APPROVED`
- Variables: {{1}} = customer_name, {{2}} = application_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Proceed to Payment" → https://tripnexio.com/{{1}}

```
Hi {{1}}, Your Visa Change quotation is approved. Application ID: {{2}}. Please complete payment using the secure button below. Booking confirmation follows successful payment.
```

### `vc_payment_pending_wa`
- Event: `VC_PAYMENT_PENDING`
- Variables: {{1}} = customer_name, {{2}} = application_id, {{3}} = currency, {{4}} = total_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = Total Amount
- Button: URL button "Complete Payment" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Reminder: payment for your Visa Change request is pending. Application ID: {{2}}. Amount due: {{3}} {{4}}. Please complete payment using the secure button below. If already paid, please disregard this reminder.
```

### `vc_paid_wa`
- Event: `VC_PAID`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}}, Thanks for choosing TripNexio! Your Visa Change booking is received and payment is confirmed. Booking ID: {{2}}. Please check your email for the invoice and next steps.
```

### `vc_documents_pending_wa`
- Event: `VC_DOCUMENTS_PENDING`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = affected_passenger_names, {{4}} = required_document_list
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Affected Passenger Names, {{4}} = Required Document List
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Following documents are required for Visa Change booking {{2}}. Passenger(s): {{3}}. Documents: {{4}}. Please upload them securely using the button below.
```

### `vc_documents_required_wa`
- Event: `VC_DOCUMENTS_REQUIRED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = affected_passenger_names, {{4}} = document_issue_list
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Affected Passenger Names, {{4}} = Document Issue List
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Following documents are required for Visa Change booking {{2}}. Passenger(s): {{3}}. Please provide/correct: {{4}}. Use the secure upload button below.
```

### `vc_documents_validated_wa`
- Event: `VC_DOCUMENTS_VALIDATED`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your Visa Change documents have been validated. Booking ID: {{2}}. We'll update you when the next confirmed stage is reached. This is not visa approval.
```

### `vc_package_generated_wa`
- Event: `VC_PACKAGE_GENERATED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Rahul Sharma, Priya Sharma
- Button: URL button "Download Package" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your Visa Change package is ready. Booking ID: {{2}}. Passenger(s): {{3}}.
```

### `vc_exit_completed_wa`
- Event: `VC_EXIT_COMPLETED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Rahul Sharma, Priya Sharma
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

The exit step for Visa Change booking {{2}} is completed. Passenger(s): {{3}}. The next step is preparing your application for submission.
```

### `vc_applied_to_embassy_wa`
- Event: `VC_APPLIED_TO_EMBASSY`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your Visa Change application has been submitted. Booking ID: {{2}}. We'll notify you when there is a verified update. Decisions remain subject to the relevant authorities.
```

### `vc_additional_documents_required_wa`
- Event: `VC_ADDITIONAL_DOCUMENTS_REQUIRED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = affected_passenger_names, {{4}} = additional_document_list, {{5}} = customer_safe_request_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Affected Passenger Names, {{4}} = Additional Document List, {{5}} = Customer Safe Request Reason
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Additional documents are required for Visa Change booking {{2}}. Passenger(s): {{3}}. Documents: {{4}}. Details: {{5}}. Please submit securely using the button below.
```

### `vc_additional_documents_submitted_wa`
- Event: `VC_ADDITIONAL_DOCUMENTS_SUBMITTED`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received the additional documents for Visa Change booking {{2}}. They are awaiting review. We'll update you when the review is complete.
```

### `vc_visa_approved_partial_applicants_wa`
- Event: `VC_VISA_APPROVED_PARTIAL_APPLICANTS`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = approved_passenger_names, {{4}} = other_passenger_outcomes
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Approved Passenger Names, {{4}} = Other Passenger Outcomes
- Button: URL button "Download Approved Visa(s)" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa approval update for Visa Change booking {{2}}. Approved passenger(s): {{3}}. Other passenger outcome(s): {{4}}. Please check each visa against the matching passport and report discrepancies within 24 hours. Full disclaimer is in your email.
```

### `vc_visa_approved_wa`
- Event: `VC_VISA_APPROVED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = country_name, {{4}} = approved_passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = United Arab Emirates, {{4}} = Approved Passenger Names
- Button: URL button "Download Visa" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Good news! Your visa is approved.
Booking ID: {{2}}
Country: {{3}}
Passenger(s): {{4}}

You can also download it from your TripNexio account.
Please verify it against the passport and report any spelling, visa type or other discrepancy within 24 hours. Full travel instructions and disclaimer are in your email.
```

### `vc_visa_rejected_wa`
- Event: `VC_VISA_REJECTED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = rejected_passenger_names, {{4}} = customer_safe_rejection_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Rejected Passenger Names, {{4}} = Customer Safe Rejection Reason
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa application update for booking {{2}}: the application for {{3}} was rejected. Reason, if available: {{4}}.
```

### `vc_on_hold_wa`
- Event: `VC_ON_HOLD`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = affected_passenger_names, {{4}} = customer_safe_hold_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Affected Passenger Names, {{4}} = Customer Safe Hold Reason
- Button: URL button "View Details" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa Change booking {{2}} is temporarily on hold. Passenger(s): {{3}}. Reason/next step: {{4}}. We'll update you when the status changes.
```

### `vc_cancellation_requested_wa`
- Event: `VC_CANCELLATION_REQUESTED`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received your cancellation request for Visa Change booking {{2}}. It is under review and is not final until confirmed. Any eligible refund is subject to policy and approval.
```

### `vc_partially_cancelled_wa`
- Event: `VC_PARTIALLY_CANCELLED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = cancelled_passenger_names, {{4}} = active_passenger_names
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Cancelled Passenger Names, {{4}} = Active Passenger Names
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa Change booking {{2}} has been partially cancelled. Cancelled: {{3}}. Still active: {{4}}. Any eligible refund is subject to policy and approval.
```

### `vc_cancelled_wa`
- Event: `VC_CANCELLED`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Visa Change booking {{2}} has been cancelled. Any eligible refund is subject to the applicable refund policy and approval.
```

### `vc_refund_completed_wa`
- Event: `VC_REFUND_COMPLETED`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = refund_id, {{4}} = currency, {{5}} = refund_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = RF-1A2B3C4D, {{4}} = Currency, {{5}} = ₹2,500
- Button: URL button "View Refund Details" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your refund for Visa Change booking {{2}} has been processed. Refund ID: {{3}}. Amount: {{4}} {{5}}. Expected in 5–7 working days, depending on your bank/payment provider.
```


## Visa Extension

### `ext_01_wa`
- Event: `EXT_01`
- Variables: {{1}} = lead_id
- Sample values: {{1}} = Lead Id
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received your Visa Extension request. Reference: {{1}}.
```

### `ext_02_wa`
- Event: `EXT_02`
- Variables: none
- Sample values: none
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your Visa Extension request is under eligibility review.
```

### `ext_03_wa`
- Event: `EXT_03`
- Variables: {{1}} = verified_customer_safe_reason
- Sample values: {{1}} = Verified Customer Safe Reason
- Button: URL button "Contact Support" → https://tripnexio.com/{{1}}

```
We're unable to proceed with your Visa Extension request. Reason: {{1}}.
```

### `ext_04_wa`
- Event: `EXT_04`
- Variables: {{1}} = total_amount
- Sample values: {{1}} = Total Amount
- Button: URL button "Review Quotation" → https://tripnexio.com/{{1}}

```
Your Visa Extension quotation is ready. Total: {{1}}.
```

### `ext_05_wa`
- Event: `EXT_05`
- Variables: none
- Sample values: none
- Button: URL button "Pay Now" → https://tripnexio.com/{{1}}

```
Your Visa Extension quotation is approved.
```

### `ext_06_wa`
- Event: `EXT_06`
- Variables: {{1}} = total_amount
- Sample values: {{1}} = Total Amount
- Button: URL button "Pay Now" → https://tripnexio.com/{{1}}

```
Payment is pending for your Visa Extension. Total: {{1}}.
```

### `ext_07_wa`
- Event: `EXT_07`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Payment received for your Visa Extension. Booking ID: {{1}}. We'll update you as processing progresses.
```

### `ext_08_wa`
- Event: `EXT_08`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your Visa Extension is ready for submission. Booking ID: {{1}}.
```

### `ext_09_wa`
- Event: `EXT_09`
- Variables: none
- Sample values: none
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your Visa Extension application has been submitted. Approval and timing depend on the authority.
```

### `ext_10_wa`
- Event: `EXT_10`
- Variables: {{1}} = verified_customer_safe_reason
- Sample values: {{1}} = Verified Customer Safe Reason
- Button: URL button "Contact Support" → https://tripnexio.com/{{1}}

```
Immigration has not accepted your Visa Extension request. Reason: {{1}}. Refund eligibility is reviewed separately.
```

### `ext_11_wa`
- Event: `EXT_11`
- Variables: {{1}} = passenger_name, {{2}} = requested_items
- Sample values: {{1}} = Passenger Name, {{2}} = Requested Items
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Additional documents required for {{1}}: {{2}}.
```

### `ext_12_wa`
- Event: `EXT_12`
- Variables: {{1}} = passenger_name
- Sample values: {{1}} = Passenger Name
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received the additional documents for {{1}}'s Visa Extension.
```

### `ext_13_wa`
- Event: `EXT_13`
- Variables: {{1}} = passenger_name
- Sample values: {{1}} = Passenger Name
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The additional documents for {{1}}'s Visa Extension have been validated.
```

### `ext_14_wa`
- Event: `EXT_14`
- Variables: {{1}} = booking_id, {{2}} = approved_passengers, {{3}} = pending_or_not_approved_passengers
- Sample values: {{1}} = 11026VI001, {{2}} = Approved Passengers, {{3}} = Pending Or Not Approved Passengers
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Partial approval for {{1}}. Approved: {{2}}. Other applicants: {{3}}.
```

### `ext_15_wa`
- Event: `EXT_15`
- Variables: none
- Sample values: none
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your Visa Extension has been approved. We'll share the copy once received and verified.
```

### `ext_16_wa`
- Event: `EXT_16`
- Variables: {{1}} = verified_customer_safe_reason_or_authority_provided_no_reason
- Sample values: {{1}} = Verified Customer Safe Reason Or Authority Provided No Reason
- Button: URL button "Contact Support" → https://tripnexio.com/{{1}}

```
Your Visa Extension request was rejected. {{1}}
```

### `ext_17_wa`
- Event: `EXT_17`
- Variables: {{1}} = verified_customer_safe_reason
- Sample values: {{1}} = Verified Customer Safe Reason
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your Visa Extension request is on hold. Update: {{1}}.
```

### `ext_18_wa`
- Event: `EXT_18`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We received your cancellation request for {{1}}. Cancellation is not final until confirmed.
```

### `ext_19_wa`
- Event: `EXT_19`
- Variables: {{1}} = booking_id, {{2}} = cancelled_passengers_or_items, {{3}} = remaining_passengers_or_items
- Sample values: {{1}} = 11026VI001, {{2}} = Cancelled Passengers Or Items, {{3}} = Remaining Passengers Or Items
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Booking {{1}} is partially cancelled. Cancelled: {{2}}. Remaining: {{3}}.
```

### `ext_20_wa`
- Event: `EXT_20`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Your Visa Extension booking {{1}} has been cancelled. Any refund is reviewed separately.
```

### `ext_21_wa`
- Event: `EXT_21`
- Variables: {{1}} = booking_id, {{2}} = confirmed_refund_amount
- Sample values: {{1}} = 11026VI001, {{2}} = Confirmed Refund Amount
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Refund for {{1}} is pending. Amount, if confirmed: {{2}}.
```

### `ext_22_wa`
- Event: `EXT_22`
- Variables: {{1}} = booking_id, {{2}} = refund_id, {{3}} = confirmed_refund_amount
- Sample values: {{1}} = 11026VI001, {{2}} = RF-1A2B3C4D, {{3}} = Confirmed Refund Amount
- Button: URL button "View Refund Details" → https://tripnexio.com/{{1}}

```
Refund completed for {{1}}. Refund ID: {{2}}. Amount: {{3}}. Posting times vary.
```


## OTB

### `otb_01_new_wa`
- Event: `OTB_01_NEW`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received your OK to Board (OTB) request. Booking reference: {{1}}. We'll update you as your request progresses.
```

### `otb_02_payment_successful_wa`
- Event: `OTB_02_PAYMENT_SUCCESSFUL`
- Variables: {{1}} = booking_id, {{2}} = payment_amount
- Sample values: {{1}} = 11026VI001, {{2}} = Payment Amount
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your payment for OTB booking {{1}} is confirmed. Amount: {{2}}. Payment confirmation does not mean OTB approval.
```

### `otb_03_document_required_wa`
- Event: `OTB_03_DOCUMENT_REQUIRED`
- Variables: {{1}} = booking_id, {{2}} = required_documents
- Sample values: {{1}} = 11026VI001, {{2}} = Required Documents
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We need the following document(s) for OTB booking {{1}}: {{2}}.
```

### `otb_04_documents_received_wa`
- Event: `OTB_04_DOCUMENTS_RECEIVED`
- Variables: {{1}} = booking_id, {{2}} = document_name
- Sample values: {{1}} = 11026VI001, {{2}} = Document Name
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received the document(s) for OTB booking {{1}}: {{2}}. They still need to be validated.
```

### `otb_05_documents_validated_wa`
- Event: `OTB_05_DOCUMENTS_VALIDATED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The submitted documents for OTB booking {{1}} have been validated. This does not guarantee airline approval.
```

### `otb_06_sent_to_airlines_wa`
- Event: `OTB_06_SENT_TO_AIRLINES`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your OTB request for booking {{1}} has been sent to the airline. The airline controls the decision and response time.
```

### `otb_07_additional_documents_received_wa`
- Event: `OTB_07_ADDITIONAL_DOCUMENTS_RECEIVED`
- Variables: {{1}} = booking_id, {{2}} = document_name
- Sample values: {{1}} = 11026VI001, {{2}} = Document Name
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received the additional document(s) for OTB booking {{1}}: {{2}}. They still need validation.
```

### `otb_08_additional_documents_validated_wa`
- Event: `OTB_08_ADDITIONAL_DOCUMENTS_VALIDATED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The additional documents for OTB booking {{1}} have been validated.
```

### `otb_09_additional_documents_submitted_wa`
- Event: `OTB_09_ADDITIONAL_DOCUMENTS_SUBMITTED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The additional documents for OTB booking {{1}} have been submitted to the airline. The airline controls the decision and response time.
```

### `otb_10_otb_approved_wa`
- Event: `OTB_10_OTB_APPROVED`
- Variables: {{1}} = passenger_names, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, Priya Sharma, {{2}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The airline has approved the OTB request for {{1}} under booking {{2}}. This is a status notification; TripNexio does not issue a separate OTB approval PDF.
```

### `otb_11_partially_approved_wa`
- Event: `OTB_11_PARTIALLY_APPROVED`
- Variables: {{1}} = booking_id, {{2}} = approved_passengers, {{3}} = pending_or_rejected_passengers
- Sample values: {{1}} = 11026VI001, {{2}} = Approved Passengers, {{3}} = Pending Or Rejected Passengers
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
There is a partial outcome for OTB booking {{1}}. Approved passenger(s): {{2}}. Other passenger(s)/outcome: {{3}}.
```

### `otb_12_rejected_wa`
- Event: `OTB_12_REJECTED`
- Variables: {{1}} = passenger_names, {{2}} = booking_id, {{3}} = verified_reason
- Sample values: {{1}} = Rahul Sharma, Priya Sharma, {{2}} = 11026VI001, {{3}} = Verified Reason
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The OTB request for {{1}} under booking {{2}} was not approved by the airline. Reason: {{3}}. For assistance, contact support@tripnexio.com.
```

### `otb_13_partially_cancellation_requested_wa`
- Event: `OTB_13_PARTIALLY_CANCELLATION_REQUESTED`
- Variables: {{1}} = cancelled_passengers, {{2}} = booking_id
- Sample values: {{1}} = Cancelled Passengers, {{2}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received the partial cancellation request for {{1}} under booking {{2}}. It is under review; cancellation is not final yet.
```

### `otb_14_partially_cancelled_wa`
- Event: `OTB_14_PARTIALLY_CANCELLED`
- Variables: {{1}} = booking_id, {{2}} = cancelled_passengers
- Sample values: {{1}} = 11026VI001, {{2}} = Cancelled Passengers
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Booking {{1}} has been partially cancelled for: {{2}}. Other passengers, if any, are not included. Any refund update will be sent when confirmed.
```

### `otb_15_cancellation_requested_wa`
- Event: `OTB_15_CANCELLATION_REQUESTED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received the cancellation request for OTB booking {{1}}. It is under review and is not yet confirmed as cancelled.
```

### `otb_16_cancelled_wa`
- Event: `OTB_16_CANCELLED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
OTB booking {{1}} is now marked as cancelled. Any applicable refund will be updated separately once confirmed.
```

### `otb_17_refund_pending_wa`
- Event: `OTB_17_REFUND_PENDING`
- Variables: {{1}} = booking_id, {{2}} = refund_amount
- Sample values: {{1}} = 11026VI001, {{2}} = ₹2,500
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The refund for OTB booking {{1}} is being processed. Confirmed amount: {{2}}. We'll notify you when completion is confirmed.
```

### `otb_18_refund_completed_wa`
- Event: `OTB_18_REFUND_COMPLETED`
- Variables: {{1}} = booking_id, {{2}} = refund_amount, {{3}} = refund_reference
- Sample values: {{1}} = 11026VI001, {{2}} = ₹2,500, {{3}} = Refund Reference
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
The refund for OTB booking {{1}} is completed. Amount: {{2}}. Refund reference: {{3}}. Your bank/payment provider may take additional time to display funds.
```

### `otb_19_cancelled_and_refunded_wa`
- Event: `OTB_19_CANCELLED_AND_REFUNDED`
- Variables: {{1}} = booking_id, {{2}} = refund_amount, {{3}} = refund_reference
- Sample values: {{1}} = 11026VI001, {{2}} = ₹2,500, {{3}} = Refund Reference
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
OTB booking {{1}} has been cancelled and the refund is completed. Amount: {{2}}. Refund reference: {{3}}.
```


## Return Verified Ticket

### `rvt_new`
- Event: `RVT_NEW`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Your Return Verified Ticket request {{1}} has been received. We'll review the details and update you on the next step.
```

### `rvt_paid`
- Event: `RVT_PAID`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Payment for request {{1}} is completed. We'll proceed with the next step and notify you if any document or information is required.
```

### `rvt_document_pending`
- Event: `RVT_DOCUMENT_PENDING`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Your request {{1}} is awaiting document review/validation.
```

### `rvt_document_required`
- Event: `RVT_DOCUMENT_REQUIRED`
- Variables: {{1}} = booking_id, {{2}} = missing_or_incorrect_documents
- Sample values: {{1}} = 11026VI001, {{2}} = Missing Or Incorrect Documents
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Action required for {{1}}: {{2}}. Processing continues after review.
```

### `rvt_documents_uploaded`
- Event: `RVT_DOCUMENTS_UPLOADED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
We've received the documents for {{1}}. They are awaiting validation; upload does not mean approval.
```

### `rvt_documents_validated`
- Event: `RVT_DOCUMENTS_VALIDATED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Documents for {{1}} have been validated. We'll move to the next processing step and keep you updated.
```

### `rvt_unable_to_process`
- Event: `RVT_UNABLE_TO_PROCESS`
- Variables: {{1}} = booking_id, {{2}} = customer_safe_reason, {{3}} = next_step, {{4}} = support_email
- Sample values: {{1}} = 11026VI001, {{2}} = Customer Safe Reason, {{3}} = Next Step, {{4}} = Support Email
- Button: URL button "Contact Support" → https://tripnexio.com/{{1}}

```
We're unable to proceed with request {{1}} at this time. Reason: {{2}}. Next step, if available: {{3}}. Contact {{4}} for help.
```

### `rvt_sent_to_airlines`
- Event: `RVT_SENT_TO_AIRLINES`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Update for {{1}}: your request has been sent to the airlines for processing. We'll notify you when there is a further update.
```

### `rvt_ticket_issued`
- Event: `RVT_TICKET_ISSUED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "Download Ticket" → https://tripnexio.com/{{1}}

```
Your ticket/reservation for {{1}} has been issued. Please check passenger and travel details.
```

### `rvt_cancellation_requested`
- Event: `RVT_CANCELLATION_REQUESTED`
- Variables: {{1}} = booking_id
- Sample values: {{1}} = 11026VI001
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
We've received the cancellation request for {{1}}. It is under review and is not confirmed yet. We'll update you once reviewed.
```

### `rvt_partially_cancelled`
- Event: `RVT_PARTIALLY_CANCELLED`
- Variables: {{1}} = booking_id, {{2}} = cancelled_scope, {{3}} = remaining_scope
- Sample values: {{1}} = 11026VI001, {{2}} = Cancelled Scope, {{3}} = Remaining Scope
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Partial cancellation confirmed for {{1}}. Cancelled passenger(s)/segment(s): {{2}}. Remaining active passenger(s)/segment(s): {{3}}.
```

### `rvt_cancelled`
- Event: `RVT_CANCELLED`
- Variables: {{1}} = booking_id, {{2}} = cancelled_scope, {{3}} = refund_status
- Sample values: {{1}} = 11026VI001, {{2}} = Cancelled Scope, {{3}} = Refund Status
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Cancellation for {{1}} is confirmed. Cancelled scope: {{2}}. Refund status, if applicable: {{3}}.
```

### `rvt_refund_pending`
- Event: `RVT_REFUND_PENDING`
- Variables: {{1}} = booking_id, {{2}} = refund_amount, {{3}} = refund_reference
- Sample values: {{1}} = 11026VI001, {{2}} = ₹2,500, {{3}} = Refund Reference
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
An eligible refund for {{1}} is being processed. Amount: {{2}}. We'll update you after completion. Reference: {{3}}
```

### `rvt_refund_completed`
- Event: `RVT_REFUND_COMPLETED`
- Variables: {{1}} = booking_id, {{2}} = refund_amount, {{3}} = refund_reference
- Sample values: {{1}} = 11026VI001, {{2}} = ₹2,500, {{3}} = Refund Reference
- Button: URL button "View Refund Details" → https://tripnexio.com/{{1}}

```
The refund for {{1}} has been completed. Amount: {{2}}. Reference: {{3}}. Please allow your bank/payment provider time to reflect it.
```


## Flight Special Fare

### `sf_01_wa`
- Event: `SF_01`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = origin, {{4}} = destination, {{5}} = travel_date
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Origin, {{4}} = Destination, {{5}} = 20 Nov 2026
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received your TripNexio special fare request {{2}} for {{3}} → {{4}} on {{5}}. Our team will review it and update you if a suitable fare is available.
```

### `sf_02_wa`
- Event: `SF_02`
- Variables: {{1}} = customer_name, {{2}} = origin, {{3}} = destination, {{4}} = travel_date, {{5}} = itinerary_summary, {{6}} = currency, {{7}} = quoted_amount, {{8}} = quote_expiry_time
- Sample values: {{1}} = Rahul Sharma, {{2}} = Origin, {{3}} = Destination, {{4}} = 20 Nov 2026, {{5}} = Itinerary Summary, {{6}} = Currency, {{7}} = Quoted Amount, {{8}} = Quote Expiry Time
- Button: URL button "Review Quotation" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your special fare quotation is ready.
Route: {{2}} → {{3}} | Date: {{4}}
Itinerary: {{5}}
Total: {{6}} {{7}}
Valid until: {{8}}
Fare is subject to final availability. Payment must be completed before expiry; payment does not confirm ticket issuance.
```

### `sf_03_wa`
- Event: `SF_03`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = quoted_amount, {{5}} = quote_expiry_time
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = Quoted Amount, {{5}} = Quote Expiry Time
- Button: URL button "Continue to Payment" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your quotation {{2}} is approved. Total: {{3}} {{4}}. Please complete payment before {{5}}.
```

### `sf_04_wa`
- Event: `SF_04`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = quote_expiry_time, {{4}} = currency, {{5}} = quoted_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Quote Expiry Time, {{4}} = Currency, {{5}} = Quoted Amount
- Button: URL button "Pay Now" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Reminder: quotation {{2}} expires at {{3}}. Amount: {{4}} {{5}}. Please pay before expiry if you wish to proceed.
```

### `sf_05_wa`
- Event: `SF_05`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "New Quotation" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your quotation {{2}} has expired and the fare is no longer guaranteed. Request a fresh quotation if you'd like us to check again.
```

### `sf_06_wa`
- Event: `SF_06`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received your request for an updated quotation for {{2}}. Our team will review current options and update you.
```

### `sf_07_wa`
- Event: `SF_07`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = amount_due, {{5}} = quote_expiry_time
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = Amount Due, {{5}} = Quote Expiry Time
- Button: URL button "Complete Payment" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Quotation {{2}} is awaiting payment. Amount: {{3}} {{4}}. Payment must be completed before {{5}}.
```

### `sf_08_wa`
- Event: `SF_08`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = paid_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = Paid Amount
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Payment received for {{2}}: {{3}} {{4}}. We'll check final availability now. Your ticket has not yet been issued.
```

### `sf_09_wa`
- Event: `SF_09`
- Variables: {{1}} = customer_name, {{2}} = origin, {{3}} = destination, {{4}} = travel_date
- Sample values: {{1}} = Rahul Sharma, {{2}} = Origin, {{3}} = Destination, {{4}} = 20 Nov 2026
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We're checking final availability for {{2}} → {{3}} on {{4}}. Your ticket is not yet issued.
```

### `sf_10_wa`
- Event: `SF_10`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = missing_documents_list, {{4}} = passengers_requiring_documents
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Missing Documents List, {{4}} = Passengers Requiring Documents
- Button: URL button "Upload Documents" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Documents required for {{2}}:
{{3}}
Passengers: {{4}}
Please upload clear, valid copies.
```

### `sf_11_wa`
- Event: `SF_11`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Documents for booking {{2}} have been validated. We'll continue processing and update you.
```

### `sf_12_wa`
- Event: `SF_12`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Track Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Booking {{2}} has been sent to the airline for processing. The ticket has not yet been issued.
```

### `sf_13_wa`
- Event: `SF_13`
- Variables: {{1}} = customer_name, {{2}} = requested_origin, {{3}} = requested_destination, {{4}} = alternative_origin, {{5}} = alternative_destination, {{6}} = alternative_itinerary, {{7}} = currency, {{8}} = alternative_amount, {{9}} = fare_difference
- Sample values: {{1}} = Rahul Sharma, {{2}} = Requested Origin, {{3}} = Requested Destination, {{4}} = Alternative Origin, {{5}} = Alternative Destination, {{6}} = Alternative Itinerary, {{7}} = Currency, {{8}} = Alternative Amount, {{9}} = Fare Difference
- Button: URL button "Review Alternative" → https://tripnexio.com/{{1}}

```
Hi {{1}},

The requested flight is unavailable.
Requested: {{2}} → {{3}}
Alternative: {{4}} → {{5}}
Itinerary: {{6}}
Fare ({{7}}): {{8}} | Difference: {{9}}
Please review route and itinerary. Not confirmed until accepted and any required payment is complete.
```

### `sf_14_wa`
- Event: `SF_14`
- Variables: {{1}} = customer_name, {{2}} = currency, {{3}} = additional_amount, {{4}} = payment_deadline
- Sample values: {{1}} = Rahul Sharma, {{2}} = Currency, {{3}} = Additional Amount, {{4}} = Payment Deadline
- Button: URL button "Pay Difference" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your approved alternative requires an additional payment of {{2}} {{3}} by {{4}}. Availability is not guaranteed until confirmed.
```

### `sf_15_wa`
- Event: `SF_15`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = origin, {{4}} = destination, {{5}} = travel_date, {{6}} = airline_flight_number, {{7}} = pnr, {{8}} = baggage
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Origin, {{4}} = Destination, {{5}} = 20 Nov 2026, {{6}} = Airline Flight Number, {{7}} = AB12CD, {{8}} = Baggage
- Button: URL button "Download Ticket" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your ticket for {{2}} has been issued. Route: {{3}} → {{4}} | Date: {{5}} | Flight: {{6}} | PNR: {{7}} | Baggage: {{8}}. Download and check all details immediately; report errors within 12 hours. Arrive at least 2 hours before domestic flights and 4 hours before international flights. Carry required ID/passport, visas and transit documents; confirm terminal, flight status, check-in and baggage rules with the airline. Passengers are responsible for visa, transit, immigration and OTB requirements where applicable. Have a safe and pleasant journey with TripNexio!
```

### `sf_16_wa`
- Event: `SF_16`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = customer_safe_hold_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Customer Safe Hold Reason
- Button: URL button "View Status" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Booking {{2}} is temporarily on hold.
Reason: {{3}}
We'll update you when there is progress.
```

### `sf_17_wa`
- Event: `SF_17`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = cancellation_scope
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Cancellation Scope
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}},

We've received your ticket cancellation request for {{2}}. Passengers/segments: {{3}}. The ticket is not yet cancelled.
```

### `sf_18_wa`
- Event: `SF_18`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Track Cancellation" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your cancellation request for {{2}} has been submitted to the airline. Cancellation is not confirmed until airline processing is complete.
```

### `sf_19_wa`
- Event: `SF_19`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = cancellation_charges, {{5}} = estimated_refund, {{6}} = cancellation_quote_expiry
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = Cancellation Charges, {{5}} = Estimated Refund, {{6}} = Cancellation Quote Expiry
- Button: URL button "Review Cancellation Quote" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Cancellation quotation for {{2}}:
Cancellation charges ({{3}}): {{4}}
Estimated refund: {{5}}
Valid until: {{6}}
Please review. Cancellation proceeds only after your approval and remains subject to airline rules.
```

### `sf_20_wa`
- Event: `SF_20`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "Track Cancellation" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your approval of the cancellation quotation for {{2}} has been received. We'll submit the approved cancellation to the airline. The ticket is not yet confirmed cancelled.
```

### `sf_21_wa`
- Event: `SF_21`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = customer_safe_rejection_reason
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Customer Safe Rejection Reason
- Button: URL button "Contact Support" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Your cancellation request for {{2}} cannot proceed at this stage.
Reason: {{3}}
Please contact support if you need clarification.
```

### `sf_22_wa`
- Event: `SF_22`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = cancellation_scope, {{4}} = currency, {{5}} = estimated_refund
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Cancellation Scope, {{4}} = Currency, {{5}} = Estimated Refund
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}},

The airline has confirmed cancellation of booking {{2}}.
Passengers/segments: {{3}}
Estimated refund: {{4}} {{5}}
We'll update you as the refund progresses.
```

### `sf_23_wa`
- Event: `SF_23`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = refund_amount
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = ₹2,500
- Button: URL button "Track Refund" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Refund for booking {{2}} is pending. Amount, if confirmed: {{3}} {{4}}. We'll update you when processing begins.
```

### `sf_24_wa`
- Event: `SF_24`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = refund_amount, {{5}} = refund_reference
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = ₹2,500, {{5}} = Refund Reference
- Button: URL button "Track Refund" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Refund for booking {{2}} is being processed.
Amount: {{3}} {{4}}
Reference: {{5}}
Your bank/payment provider may need additional time to post it.
```

### `sf_25_wa`
- Event: `SF_25`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = currency, {{4}} = refund_amount, {{5}} = refund_reference
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Currency, {{4}} = ₹2,500, {{5}} = Refund Reference
- Button: URL button "View Refund Details" → https://tripnexio.com/{{1}}

```
Hi {{1}},

Refund for booking {{2}} has been completed from our side.
Amount: {{3}} {{4}}
Reference: {{5}}
Please allow your bank/payment provider its usual processing time.
```

### `sf_27_wa`
- Event: `SF_27`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = alternative_summary
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Alternative Summary
- Button: URL button "Review Options" → https://tripnexio.com/{{1}}

```
Hi {{1}}, the requested flight for booking {{2}} is unavailable at final confirmation. Sorry for the inconvenience. Alternative: {{3}}. Please review the options and choose an alternative or request cancellation. No ticket has been issued.
```

### `sf_28_wa`
- Event: `SF_28`
- Variables: {{1}} = customer_name, {{2}} = booking_id
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001
- Button: URL button "View Request" → https://tripnexio.com/{{1}}

```
Hi {{1}}, we've received your normal cancellation request for booking {{2}}. The ticket is not yet cancelled. We'll share airline cancellation charges and the estimated refund for approval before final cancellation.
```

### `sf_29_wa`
- Event: `SF_29`
- Variables: {{1}} = customer_name, {{2}} = booking_id, {{3}} = cancellation_scope, {{4}} = currency, {{5}} = estimated_refund
- Sample values: {{1}} = Rahul Sharma, {{2}} = 11026VI001, {{3}} = Cancellation Scope, {{4}} = Currency, {{5}} = Estimated Refund
- Button: URL button "View Booking" → https://tripnexio.com/{{1}}

```
Hi {{1}}, the airline has confirmed cancellation of booking {{2}}. Passengers/segments: {{3}}. Estimated refund: {{4}} {{5}}. We'll update you as the refund progresses.
```
