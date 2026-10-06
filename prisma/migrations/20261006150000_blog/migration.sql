-- Client request 2026-10-06: the website blog (/blog), managed in Admin → Blog.
-- Also inserts the first three posts (idempotent on slug). They describe
-- TripNexio's own services in the words of the approved service pages and
-- state no fees, prices or official rules; Admin can edit or unpublish them.

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "coverImageUrl" TEXT,
    "coverFileUrl" TEXT,
    "coverImageAlt" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'TripNexio Team',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_category_idx" ON "BlogPost"("category");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- First three posts
INSERT INTO "BlogPost" ("id", "slug", "title", "excerpt", "body", "category", "tags", "coverImageUrl", "coverImageAlt", "seoTitle", "seoDescription", "status", "publishedAt", "updatedAt")
VALUES
(
  'blog-what-is-otb',
  'what-is-otb-ok-to-board',
  'What Is OTB (OK to Board) and When Do You Need It?',
  'OTB is an airline confirmation that clears you to board. Here is what it means, which documents you need and how TripNexio handles your OTB request from start to finish.',
  $post$Some airlines ask certain passengers to get an **OTB (OK to Board)** confirmation before they are allowed to check in. If your airline asks for it and it is not in place, you may not be allowed to board, even with a valid ticket and visa. This guide explains what OTB is and how the process works with TripNexio.

## What is OTB?
OTB stands for **OK to Board**. It is not a separate travel document that you carry. It is a confirmation or update that the airline records against your booking, showing that your travel documents have been checked and you are cleared to board.

Whether you need OTB depends on your airline and your journey. Always check what your airline asks for before you travel.

## Documents you will need
To process an OTB request, TripNexio asks for:
- Passport front page
- Passport last page
- Valid visa copy
- Onward ticket
- Return ticket

Clear, complete scans help avoid delays. If anything is missing or unclear, our team will tell you what to send.

## Normal and urgent processing
You can choose **Normal** or **Urgent** processing, depending on how soon you travel. The options shown to you are based on your travel date and the processing time for your airline, so you only see what can realistically be completed before your flight.

## How the process works
- **Share your flight details:** enter your airline, travel date and contact details.
- **Submit your documents and pay:** provide the required documents, review the service details and complete payment.
- **We process your OTB:** TripNexio coordinates the request through the relevant airline channel.
- **Get your OTB confirmation:** once the airline confirms, we share the confirmation with you on WhatsApp and email and update your status.

## Track your OTB status
You can follow your request on the [Track Status](/track) page with your reference number. We also send updates on WhatsApp and email at every important step.

## Need a return ticket too?
If you don't have a return ticket yet, you can add a [Return Verified Ticket](/services/return-ticket) to your request. Ready to start? [Apply for OTB](/services/otb).$post$,
  'Flights & OTB',
  ARRAY['OTB', 'OK to Board', 'Airlines', 'Travel documents'],
  '/images/services/otb.jpg',
  'Traveller at the airport checking flight details before boarding',
  'What Is OTB (OK to Board)? Documents & Process',
  'Learn what OTB (OK to Board) means, which documents you need and how TripNexio processes your OTB request with WhatsApp and email updates.',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'blog-visa-change-vs-extension',
  'visa-change-vs-visa-extension-uae',
  'Visa Change vs Visa Extension in the UAE: Which One Do You Need?',
  'Both services help you stay longer in the UAE, but they work very differently. Here is how Visa Change and Visa Extension compare, and how to choose the right one.',
  $post$If you are in the UAE and want to stay longer, you will usually come across two options: **Visa Extension** and **Visa Change**. They solve a similar problem in different ways. This guide explains the difference so you can pick the right service.

## Visa Extension: stay on your current visa for longer
A Visa Extension extends the visa you already have. TripNexio offers it for visas issued through TripNexio.

How it works with TripNexio:
- **Start your extension request:** confirm your UAE entry date and the extension details you need.
- **We verify your visa and documents:** our team checks your TripNexio-issued visa, its actual expiry and the required documents for eligibility.
- **Review and pay:** once verification is complete, you review the quotation and complete payment.
- **Receive your extended visa:** we process the extension and send the extended visa copy by WhatsApp and email.

## Visa Change: exit, re-enter and start a new visa
A Visa Change gives you a new visa. It involves leaving the UAE and coming back, and it is only for travellers who are currently inside the UAE. It can be requested by eligible UAE tourist visa holders and eligible holders of a cancelled UAE residence visa.

There are two ways to do it:
- **Airport to Airport (A2A):** you exit and re-enter by flight through an airport confirmed by our team.
- **Border Exit:** you exit and re-enter by road through a border crossing, with transport arranged as part of the package.

Our team checks availability, shares the available option, and after you choose your date, time and package and complete payment, you follow the exit instructions. After the exit is completed, the new visa process starts and the approved visa is delivered to you.

## What is included in a Visa Change package?
- **A2A:** round-trip flight ticket and the new UAE visa.
- **Border Exit:** round-trip border transport and the new UAE visa, plus a stay where applicable.

Fines, border or immigration fees and meals are not included. The exact inclusions are shown on your quotation before you pay.

## Which one should you choose?
- Choose **Visa Extension** if you hold a TripNexio-issued visa and want to continue on it.
- Choose **Visa Change** if you are inside the UAE and need a new visa rather than an extension.
- If you are outside the UAE, use our [New Visa](/services/new-visa) service instead.

Not sure? Message us on [WhatsApp](/whatsapp-support) and our team will guide you. You can also explore [Visa Extension](/services/visa-extension) and [Visa Change](/services/visa-change).$post$,
  'Visa Guides',
  ARRAY['UAE', 'Visa Change', 'Visa Extension', 'A2A', 'Border Exit'],
  '/images/services/visa-extension.jpg',
  'Passport and visa documents ready for a UAE visa application',
  'Visa Change vs Visa Extension in the UAE',
  'Compare UAE Visa Change (A2A or Border Exit) and Visa Extension: how each works, what is included and how to choose the right service.',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'blog-visa-document-checklist',
  'visa-application-document-checklist',
  'How to Prepare Your Documents for a Visa Application',
  'Most visa delays come from documents that are unclear, incomplete or don''t match. Use this simple checklist to get your documents right the first time.',
  $post$A smooth visa application starts with good documents. Most delays happen because a scan is blurry, a page is missing or a detail doesn't match. Here is how to prepare your documents before you apply.

## Start with your passport
Your passport is the most important document in almost every application.
- Check the expiry date. Many destinations expect your passport to stay valid for at least six months after you travel. If yours expires sooner, TripNexio will flag it so you can decide what to do before you pay.
- Scan the **front (photo) page** and the **last page** in full, with all four corners visible.
- Make sure the text and the machine-readable lines at the bottom of the photo page are sharp and readable.

## Use a clear passport photo
Use a recent photo with a plain, light background, your face clearly visible and no shadows. Avoid filters or heavily edited images.

## Scan, don't just snap
- Use good, even light and avoid glare on the page.
- Keep the page flat and fill the frame.
- Upload images or PDFs that are easy to read when zoomed in.

## Make sure the details match
Your name, date of birth and passport number should be exactly the same on every document you submit. Small differences are one of the most common reasons for extra questions.

## Additional documents may be required
Each destination has its own checklist, and the documents for your country are shown on its New Visa page before you apply. Additional documents may be requested during processing if the relevant authority asks for them. Our team will tell you exactly what is needed.

## Save time on your next trip
If you have applied with TripNexio before, you can choose to reuse documents you already shared with us, as long as they are still valid. You will always be asked before anything is reused.

## Ready to apply?
Browse destinations on our [New Visa](/services/new-visa) page, or follow an existing application on [Track Status](/track).$post$,
  'Travel Tips',
  ARRAY['Visa documents', 'Passport', 'Checklist', 'New Visa'],
  '/images/services/new-visa.jpg',
  'Passport and travel documents laid out for a visa application',
  'Visa Document Checklist: Prepare Your Application',
  'A simple checklist for your visa documents: passport validity, clear scans, matching details and photos, so your application is not delayed.',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
