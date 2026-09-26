# TripNexio — Pending Work, Extracted (Ready-to-Use Prompts)

**Source:** every ❌ Not-done and 🟡 Partially-done item from `client-message/DOCS_FOLDER_COMPLETION_AUDIT.md`, pulled out on its own and turned into a standalone, copy-pasteable build prompt — same format as `DEVELOPMENT_ROADMAP.md`. Work one item at a time; each is self-contained.

**Status key:** ⬜ not started

---

## Group A — The 5 service pages' visual/content redesign (Sep 24 "Final Content, Design & FAQ" docs)

Only the FAQ content and basic wording tone from these 5 docs were built. The actual page redesign each doc specifies — hero copy, the New Visa product selector, and the "reference-style" step visual — was never built. This is the single biggest chunk of pending work.

### Item 1 — New Visa: interactive product-selection cards ⬜
**Source:** `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx`
**Problem:** The doc's centerpiece is an interactive selector — Stay Duration (30/60 days) × Entry Type (Single/Multiple) × Adult/Child +/− counters, with the displayed price updating live as the customer changes a selection. The live page (`src/app/services/new-visa/page.tsx`) is currently a static "what you'll need" bullet list — none of this exists.

**Prompt to use:**
> "Re-read `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx` in full first — extract the exact copy, card layout, and pricing-selector behavior it specifies (Stay Duration × Entry Type × Adult/Child counters, live price). Build this as a new interactive section on `src/app/services/new-visa/page.tsx` (Client Component island, following CLAUDE.md's 'Server Components by default, Client only where needed' rule). Wire the live price to the real `PricingRule`/New Visa pricing lookup already used by `computeNewVisaPrice()` (`src/lib/new-visa/pricing.ts`) — reuse it, don't hardcode prices in the new component. This is a display/selection UI only; the actual request flow (`/services/new-visa/request`) and its schema/validation are unaffected — the selector should hand off the chosen stay-duration/entry-type/traveller-counts as pre-filled defaults into that existing flow, not duplicate its logic. Verify: changing any selector value updates the shown price immediately, and starting a request from the selector correctly pre-fills the multi-step form."

---

### Item 2 — New Visa: "UAE Visa Applications From Across India" section ⬜
**Source:** `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx`
**Problem:** This named section from the doc doesn't exist anywhere on the live page.

**Prompt to use:**
> "Re-read `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx` and locate the 'UAE Visa Applications From Across India' section — extract its exact copy/structure. Add it to `src/app/services/new-visa/page.tsx` in the position the doc implies (relative to the hero/product-selector/FAQ sections). Follow the project's light-first design system (`GlassCard`, `SectionHeading`, existing spacing/typography conventions — don't invent new patterns). Verify it renders correctly on both desktop and mobile."

---

### Item 3 — New Visa: "The Visa Process" reference-style step visual ⬜
**Source:** `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx` (+ its reference image, if one was supplied alongside the doc)
**Problem:** The doc calls for a specific visual treatment — a curved/dotted path connecting 4 numbered milestones, matching a supplied reference image — for the "How It Works" section. The live page currently uses a plain 3-icon-in-a-row grid instead (different step count, different visual style entirely).

**Prompt to use:**
> "Re-read `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx`'s 'The Visa Process' section and locate any reference image supplied with it (check `docs/image.png` and ask the client if a different reference was meant). Rebuild New Visa's `howItWorks` section on `src/app/services/new-visa/page.tsx` as a 4-milestone curved/dotted-path visual matching that reference, replacing the current plain icon-grid `howItWorks` array. Use inline SVG for the path (matching this project's existing pattern of hand-built SVG for chart/decorative elements — see `src/components/crm/charts/` for the house style, though this is customer-facing so should follow the site's glassmorphism/light-first look, not the CRM's dark theme). Respect `prefers-reduced-motion` if you add any scroll-reveal animation to it (existing `MotionReveal` component). Verify it renders correctly at both desktop and mobile widths — this is exactly the kind of layout that's easy to get right on desktop and broken on mobile, so check both explicitly."

---

### Item 4 — New Visa: hero copy exact match ⬜
**Source:** `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx`
**Problem:** The current hero heading/body text on `src/app/services/new-visa/page.tsx` uses different wording than the doc's locked copy.

**Prompt to use:**
> "Re-read `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx`'s hero section copy exactly as written. Update `src/app/services/new-visa/page.tsx`'s hero heading and body paragraph to match it verbatim (not paraphrased) — this is locked client copy, not a suggestion. Don't change layout/structure, just the text content. Verify by direct side-by-side comparison against the source doc, not from memory."

---

### Item 5 — Visa Extension: step visual + hero copy ⬜
**Source:** `docs/TripNexio_UAE_Visa_Extension_Final_Page_Content_Design_FAQ_FINAL.docx`
**Problem:** Same two gaps as New Visa (Items 3-4), scaled to this service: the reference-style 4-milestone step visual isn't built (`src/app/services/visa-extension/page.tsx` still uses the plain icon-grid `howItWorks`), and hero/body copy hasn't been checked line-by-line against the doc's exact locked text.

**Prompt to use:**
> "Re-read `docs/TripNexio_UAE_Visa_Extension_Final_Page_Content_Design_FAQ_FINAL.docx` in full. (1) Replace `src/app/services/visa-extension/page.tsx`'s current plain icon-grid `howItWorks` section with the reference-style curved-path/numbered-milestone visual the doc specifies — reuse whatever SVG/animation approach is built for New Visa's equivalent (Item 3 above) rather than inventing a second implementation; extract a shared component if the two turn out identical. (2) Update the hero heading/body and any other locked-copy sections on this page to match the doc's exact wording. Verify both at desktop and mobile widths, and by direct comparison against the source doc."

---

### Item 6 — Visa Change: step visual + hero copy ⬜
**Source:** `docs/TripNexio_Visa_Change_Final_Page_Content_Design_FAQ_FINAL_V3.docx`
**Problem:** Same pattern as Item 5, for `src/app/services/visa-change/page.tsx`.

**Prompt to use:**
> "Re-read `docs/TripNexio_Visa_Change_Final_Page_Content_Design_FAQ_FINAL_V3.docx` in full. Replace `src/app/services/visa-change/page.tsx`'s plain icon-grid `howItWorks` section with the reference-style curved-path/numbered-milestone visual (reuse the shared component from Item 3/5 if one was extracted). Update hero/body copy to match the doc's exact locked wording. Verify at desktop and mobile, against the source doc directly."

---

### Item 7 — Flight Special Fare: step visual + hero copy ⬜
**Source:** `docs/TripNexio_Flight_Special_Fare_Final_Page_Content_Design_FAQ_FINAL.docx`
**Problem:** Same pattern, for `src/app/services/flight-special-fare/page.tsx`.

**Prompt to use:**
> "Re-read `docs/TripNexio_Flight_Special_Fare_Final_Page_Content_Design_FAQ_FINAL.docx` in full. Replace `src/app/services/flight-special-fare/page.tsx`'s plain icon-grid `howItWorks` section with the reference-style curved-path/numbered-milestone visual (reuse the shared component from Items 3/5/6 if one was extracted). Update hero/body copy to match the doc's exact locked wording. Verify at desktop and mobile, against the source doc directly."

---

### Item 8 — Return Ticket: step visual + hero copy ⬜
**Source:** `docs/TripNexio_Return_Verified_Ticket_Final_Page_Content_Design_FAQ_FINAL_v3.docx`
**Problem:** Same pattern, for `src/app/services/return-ticket/page.tsx` — note this page was already rewritten once this session for the Expected-Return-Date change, so re-check its content against the doc from scratch rather than assuming the earlier edit covered this too.

**Prompt to use:**
> "Re-read `docs/TripNexio_Return_Verified_Ticket_Final_Page_Content_Design_FAQ_FINAL_v3.docx` in full. Replace `src/app/services/return-ticket/page.tsx`'s plain icon-grid `howItWorks` section with the reference-style curved-path/numbered-milestone visual (reuse the shared component from Items 3/5/6/7 if one was extracted). Update hero/body copy to match the doc's exact locked wording — double-check this page specifically, since it was already edited once this session for the Expected-Return-Date change and may only partially reflect this doc's full copy. Verify at desktop and mobile, against the source doc directly."

---

## Group B — Business logic gaps

### Item 9 — Visa Change: nationality/adult/child pricing breakdown ⬜
**Source:** `docs/TripNexio_Visa_Change_Developer_Handover.docx`
**Problem:** The spec requires Admin pricing to support nationality-wise, adult-wise, and child-wise rates for Visa Change. Today `Quotation`'s Visa Change fields are the generic `feeAmount + fineOrCharges` shape (same as OTB/Return Ticket) — no rate breakdown exists. Staff enters one lump-sum price.

**Prompt to use:**
> "Visa Change needs nationality/adult/child-wise pricing, per `docs/TripNexio_Visa_Change_Developer_Handover.docx`'s locked rule — re-read it first to confirm the exact rate structure (is it a flat surcharge per category, a full separate rate table, etc.). Decide whether to extend the existing central `PricingRule` model (Step 40, already has `nationality`+`paxType` dimensions) to cover Visa Change, or whether Visa Change's shape is different enough to need its own fields on `Quotation` (same 'bad-fit merge, flag don't force' judgment call already made for OTB/Return Ticket in Step 40 — explain your choice). Update the Visa Change quote-builder UI (`QuoteBuilderForm.tsx`) and the pricing computation accordingly. Verify with a real quote across at least 2 nationalities and both adult+child counts, confirming the total is computed correctly, not just accepted as a lump sum."

---

### Item 10 — Visa Extension: Day-25 re-extension reminder automation ⬜
**Source:** `docs/TripNexio_Visa_Extension_Updated_Developer_Handover.docx` (FAQ §12) / `docs/TripNexio_UAE_Visa_Extension_Final_Page_Content_Design_FAQ_FINAL.docx`
**Problem:** No automation exists that reminds a customer around day 25 of their extension to consider re-extending. The 4 existing n8n jobs (quote-expiry, payment-followup, OTB-requirement-check, lead-followup) don't cover this.

**Prompt to use:**
> "Add a 5th n8n automation job, following the exact pattern of the existing 4 in `src/app/api/automation/` (`src/lib/automation/` for the shared dedup/`AutomationReminderLog`/`AutomationRun` helpers — reuse them, don't rebuild): `POST /api/automation/visa-extension-reminder`, running daily, that finds converted Visa Extension bookings whose visa-extension grant date is ~25 days in the past (re-read the source docs to confirm the exact trigger day and whether it's from grant date or entry date) and sends a new `VISA_EXTENSION_REMINDER` notification event via the existing `notifyCustomer()` (Email+WhatsApp) pipeline — needs a new seeded `NotificationTemplate` row for this event, same placeholder-syntax convention as the others. Add the corresponding n8n workflow JSON under `n8n/workflows/` matching the existing 4. Verify: a test booking backdated to day 25 fires exactly once (dedup via `AutomationReminderLog`, same as the other jobs), and doesn't re-fire on a second run."

---

## Group C — Admin: small, self-contained items

### Item 11 — Admin: SMS as a notification channel ⬜
**Source:** `docs/TripNexio_Admin_FINAL_Developer_Handover_All_Corrections.docx` §17
**Problem:** `NotificationChannel` enum is `WHATSAPP`/`EMAIL` only — SMS was never added, even though the doc asks for it alongside those two.

**Prompt to use:**
> "Add `SMS` to the `NotificationChannel` enum (additive Postgres `ADD VALUE`, same safe pattern as previous enum additions this project — see Step 51's `OTHER` ServiceType addition for the precedent) and build an SMS sending service-layer abstraction matching the existing pattern exactly: an `SmsSender` interface (`src/lib/sms/sender.ts`), a real provider implementation (ask the client which SMS gateway they want — e.g. Twilio, MSG91 — before picking one; this needs a new `TODO: client provides` env var following the `isPlaceholder()` convention already used for Razorpay/Resend/WhatsApp/Anthropic), and a `ConsoleSmsSender` dev fallback. Wire it into `notifyCustomer()` (`src/lib/notifications/notify.ts`) as a third independent channel alongside email/WhatsApp — a failure or skip on SMS must never block or be blocked by the other two, same as the existing pattern. Every `NotificationTemplate` needs an SMS-channel variant seeded before this does anything customer-visible; flag that as follow-up work, don't fabricate SMS copy yourself. Verify with the console fallback: an event fires, SMS is logged (not sent), audited as `SMS_SENT`/`SMS_SKIPPED`/`SMS_FAILED` matching the existing `EMAIL_SENT`/etc. convention."

---

### Item 12 — Admin: automatic airline-logo fetch ⬜
**Source:** `docs/TripNexio_Admin_FINAL_Developer_Handover_All_Corrections.docx` §11
**Problem:** No code anywhere fetches an airline's logo automatically when it's selected in the Admin Airlines screen or the quote builder's airline picker.

**Prompt to use:**
> "Add automatic airline-logo display per `docs/TripNexio_Admin_FINAL_Developer_Handover_All_Corrections.docx` §11: add a `logoUrl` field to the `Airline` model (nullable), and when an Admin adds/edits an airline in `AirlinesManager.tsx`, auto-populate it from a public airline-logo API keyed by IATA code (research a free/low-cost option — e.g. a logos-by-IATA-code CDN — and confirm it with the client before committing to a paid one). Show the logo next to the airline name everywhere an airline is already displayed (Admin Airlines list, the quote builder's airline `<select>`, any customer-facing airline mention). Fall back to no logo (not a broken image) when the API has no match for a code. Verify with a real IATA code that the chosen provider recognizes, and with one it doesn't (confirming the fallback)."

---

### Item 13 — Admin: audit-retention purge job ⬜
**Source:** `docs/TripNexio_Admin_FINAL_Developer_Handover_All_Corrections.docx` §19
**Problem:** `SystemConfig.auditRetentionDays` exists as a configurable field (Step 45) but nothing actually reads it — no job purges old `AuditTrail` rows. Already self-flagged in Step 45's own notes as a known gap, not a new discovery, but still open.

**Prompt to use:**
> "Add a 6th n8n automation job, `POST /api/automation/audit-retention`, following the exact pattern of the existing jobs (reuse `AutomationRun`/the shared automation-auth helper in `src/lib/automation/`): reads `SystemConfig.auditRetentionDays` (`src/lib/settings/system-config.ts`), and deletes `AuditTrail` rows older than that many days — but confirm with the client first whether 'retention' means hard-delete or archive-then-delete, since this is destructive and audit data is often needed for compliance/dispute resolution (don't silently assume hard-delete). Log a summary (rows deleted, date cutoff) to the job's own `AutomationRun.summary`, and dry-run it manually against a copy of real data before ever scheduling it to run automatically. Verify with a test AuditTrail row backdated past the cutoff, confirming it's the ONLY thing removed."

---

## Group D — Needs a client decision before any code should be written

These aren't ready for a build prompt yet — building them now would mean guessing at scope, which this project's own hard rule #1 says not to do.

### Item 14 — Knowledge Centre ✅ done
**Source:** `docs/TripNexio_Internal_Dashboard_All_Requirements_Merged.docx` §12
**Scope decision (client, 2026-09-26):** all three — internal staff SOPs/documentation, a searchable FAQ-for-staff, and training material — combined into one module rather than three separate ones.
**Built:** `KnowledgeArticle` model (category enum SOP/STAFF_FAQ/TRAINING, keywords for search, active on/off), new `knowledge.view`/`knowledge.edit` permissions (view granted to Staff by default, edit Admin-only by default — same "ops lead curates" reasoning as `masters.manage`), `/crm/knowledge-centre` screen (search + category filter, editable cards for anyone with `knowledge.edit`, read-only for view-only staff), `GET/POST /api/knowledge-articles` + `PATCH /api/knowledge-articles/[id]`. Verified end-to-end: create/update/disable as Admin, a `knowledge.view`-only role can read but gets 403 on write, default Staff role confirmed to have view but not edit. Not visually confirmed in a browser this round — the Chrome tool hit repeated flakiness (500s from a dropped dev-DB connection, then empty/reset form fields) after 3+ attempts; verified via direct API calls instead, per this session's established fallback.

### Item 15 — Full wordmark/logo vector files
**Source:** `docs/brand/BRAND_ASSET_MANIFEST.md`
**Not a dev task** — the source brand PDF never included machine-readable vector files for the full wordmark/horizontal/stacked/monochrome/reverse-white logo lockups (only the symbol mark exists today). **Ask the client** to supply real vector source (AI/EPS/SVG) for these, or approve deriving them in-house from the existing symbol.

### Item 16 — Full real airport database (Special Fare / OTB)
**Source:** `docs/TripNexio_Special_Fare_Developer_Handover.docx`
**Not a dev task** — CSV bulk-import already works (Admin → Airports), it's just never been run against a real, complete dataset, per this project's "never invent domain data" rule. **Ask the client** to supply or approve a real IATA/OpenFlights-sourced airport list.

### Item 17 — New Visa: Apply Now → Login/Guest interstitial
**Source:** `docs/TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx`
**Blocked, not forgotten** — this depends on real customer-facing Auth.js sessions, which per `CLAUDE.md`'s own Auth section are still frontend-only mocks (no real backend). This isn't a New-Visa-specific gap; it's the same longstanding customer-auth gap the whole project has always disclosed. Building the interstitial only makes sense once real customer auth exists — treat that as its own separate, larger prompt if/when the client wants it prioritized.

---

## Suggested order

1. Items 1-4 (New Visa redesign) — highest-visibility, most work, do first.
2. Items 5-8 (the other 4 services' step-visual + copy) — same pattern, faster once Item 3's component is reusable.
3. Item 9 (Visa Change pricing) — real business-logic gap.
4. Items 11-13 (Admin small items) — quick, self-contained.
5. Item 10 (Visa Extension reminder automation).
6. Items 14-17 — resolve with the client first, then convert into real build prompts.
