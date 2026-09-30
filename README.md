# TripNexio

TripNexio is a worldwide visa and travel services platform. Customers request a service online, the request becomes a **lead** in the staff CRM, staff build a **quote**, the customer accepts it and it becomes a **booking**, and the customer **pays** through a payment link. Staff then process the case manually with vendors, embassies and airlines, and upload the output (visa PDF, ticket, OTB confirmation) for the customer.

There is **no live booking API** — no live flight search, no automated visa submission. Every price is staff-entered or Admin-configured.

**Services:** New Visa, Visa Extension, Visa Change (Airport-to-Airport and Border Exit), Flight Special Fare, Return Verified Ticket, OTB (OK to Board). Customers also get Track Status, an Ask TripNexio AI page (FAQ-grounded), a `/account` area, and a WhatsApp bot.

**Internal apps:** the staff CRM at `/crm` (leads, customers, quotations, bookings, payments, refunds, documents, tasks, reports) and the Admin panel at `/admin` (RBAC, service configuration, master data, pricing, finance and MIS reports, monitoring, integrations health).

---

## Tech stack

| Area | Package (version installed from `package-lock.json`) |
| --- | --- |
| Framework | Next.js 16.3.4 (App Router), React 19.2.8, TypeScript 5.9 (strict) |
| Styling / UI | Tailwind CSS 4, framer-motion 13.1.1, lucide-react, sonner (toasts) |
| Forms / validation | react-hook-form 7, zod 4.5.4 (schemas shared by client, API and the WhatsApp bot) |
| Database | PostgreSQL + Prisma **7.10.0** (`prisma-client` generator, `@prisma/adapter-pg` driver adapter) |
| Auth | Hand-rolled JWT cookie sessions (`jose`, `bcryptjs`); separate staff and customer sessions; optional Google Sign-In |
| Payments | Razorpay 2.9.8 (Payment Links API), invoices via pdfkit 0.20.2 |
| Email | Resend 6.26.0 |
| WhatsApp | Meta WhatsApp Cloud API (raw `fetch`, no SDK) |
| AI / OCR | `@anthropic-ai/sdk` 0.124.0 (WhatsApp bot intent + FAQ answers, passport OCR) |
| Tests | vitest 4.1.11 |

**Prisma is pinned to 7.x on purpose.** Do not run `npm install prisma@latest` — the `latest` tag has pointed at an 8.x release candidate. Check `npm view prisma dist-tags` and pick a stable version.

## Repository layout

```
src/app/            Routes: public site, /account, /pay/[token], /quote/[token], /track, /ai,
                    /crm/** (staff), /admin/** (admin), /api/** (route handlers)
src/components/     UI by area: layout, ui, forms, services, crm, admin, ai, track, ...
src/lib/            Domain logic: leads, quotations, bookings, payments, refunds, documents,
                    service-status, notifications, email, whatsapp, whatsapp-bot, ocr,
                    automation, reports, auth, settings, csv, storage, ...
src/generated/      Generated Prisma client (gitignored; `npm run db:generate`)
src/proxy.ts        Edge JWT check for /crm/** and /admin/** (Next 16's renamed middleware)
prisma/             schema.prisma, migrations/, seed.ts, seed-service-statuses.ts, faq-seed-data.ts
prisma7.config.ts   Prisma CLI config (DATABASE_URL, migrations path, seed command)
tests/              vitest suites
scripts/            backup-db.sh, cleanup-test-data.ts
n8n/workflows/      Importable n8n workflow JSON for every automation job
vercel.json         Vercel Cron schedules
docs/               Client handovers, brand, deployment guides, audit
client-message/     Client's locked spec documents (CRM.md, ADMIN.md, per-service specs)
```

## Local setup

Requirements: **Node 22** (the version CI uses) and npm.

1. **Install:** `npm install` (runs `prisma generate` via `postinstall`).
2. **Start a local database.** This project uses a Prisma-managed local Postgres, separate from any other Postgres on the machine:
   ```bash
   npx prisma dev --name tripnexio --detach
   npx prisma dev ls        # shows the connection URL / port
   ```
3. **Environment:** copy `.env.example` to `.env`. Set `DATABASE_URL` to the URL from `prisma dev ls` (append the pool-tuning parameters described in `.env.example`), generate `STAFF_SESSION_SECRET` / `CUSTOMER_SESSION_SECRET` / `AUTOMATION_API_KEY`, and set `SEED_ADMIN_PASSWORD` (12+ characters). Third-party keys can stay as `TODO` placeholders (see Integrations).
4. **Database:**
   ```bash
   npm run db:migrate    # prisma migrate dev — applies all migrations
   npm run db:generate   # regenerate the client if needed
   npm run db:seed       # RBAC, permissions, service statuses, FAQs, clearly-labelled "Sample" masters
   ```
   The seed creates the staff login `admin@tripnexio.com` with the password from `SEED_ADMIN_PASSWORD`. It refuses to run without it and never prints it.
5. **Run:** `npm run dev`, then open http://localhost:3000 (staff: http://localhost:3000/crm/login).

If `prisma migrate dev` or the app reports `ConnectionClosed` / P1017, the local database has stopped or is overloaded. Restart it with `npx prisma dev stop tripnexio` and `npx prisma dev start tripnexio`, and update the port in `.env` if it changed.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / serve (the build never runs migrations) |
| `npm run lint` | ESLint |
| `npm test` | vitest (`vitest run`) |
| `npm run db:generate` | `prisma generate` → `src/generated/prisma` |
| `npm run db:migrate` | `prisma migrate dev` (local only) |
| `npm run db:seed` | `prisma db seed` (needs `SEED_ADMIN_PASSWORD`) |
| `npm run db:studio` | Prisma Studio |

Before committing, run `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build`.

## Testing and CI

- Unit tests live in `tests/*.test.ts` (and `src/**/*.test.ts`): reference-ID generation (sequence, month rollover, concurrency), pricing totals, refund rules, OTB processing and working calendar, quote payability, status transitions. The config is in `vitest.config.ts`, which mirrors the `@/` path alias.
- `.github/workflows/ci.yml` runs on every push and PR to `master`: `npm ci` → `prisma generate` → `tsc --noEmit` → `npm run lint` → `npm test`. It uses a dummy `DATABASE_URL` and no secrets.

## Integrations and environment variables

`.env.example` is the authoritative list of every variable, with a comment on where each value comes from. **A placeholder value (empty, or starting with `TODO`) means "not configured"**. In development the app then falls back to a safe local implementation, so every flow still works end to end:

| Integration | Env vars | Fallback when unset |
| --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Mock gateway (same HMAC webhook scheme). **In production, missing keys are a hard configuration error — never the mock.** |
| Resend email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Emails are logged to the server console (masked recipient) |
| WhatsApp Cloud API | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Console gateway. The webhook hard-fails in production without `WHATSAPP_APP_SECRET`. |
| Anthropic (bot + OCR) | `ANTHROPIC_API_KEY` | Keyword intent/FAQ matcher; OCR returns a clearly-labelled SAMPLE passport result |
| Google Sign-In | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google buttons are hidden and `/api/auth/google/*` returns 404 |
| Scheduler auth | `AUTOMATION_API_KEY` (n8n / VPS cron), `CRON_SECRET` (Vercel Cron) | Both unset → every `/api/automation/*` call is rejected (safe-closed) |
| Sessions | `STAFF_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET` | Required |
| Seed | `SEED_ADMIN_PASSWORD` | Seed refuses to run |
| Database | `DATABASE_URL` | Required |

Optional: `FILE_STORAGE=db` stores uploads in the database (`FileBlob`) instead of private local disk (`storage/uploads/`). Serverless hosts use the database automatically. Files are only ever served through the access-controlled `/api/files/[id]`.

Setup guides: `docs/deployment/EMAIL_SETUP.md`, `docs/deployment/WHATSAPP_SETUP.md`, `docs/deployment/N8N_SETUP.md`.

## Automation / cron

Time-based jobs (quote expiry and reminders, payment-link expiry and reminders, document and OTB reminders, lead and Special Fare follow-ups, Visa Extension day-25 reminder, Return Ticket auto-complete, abandoned-quote coupons, staff alerts, SLA escalation, document and audit retention) are plain API routes under `/api/automation/*`. Each route accepts:

- `POST` with `Authorization: Bearer <AUTOMATION_API_KEY>`, from n8n (workflows in `n8n/workflows/`) or a VPS cron, or
- `GET` with `Authorization: Bearer <CRON_SECRET>`, from Vercel Cron (schedules in `vercel.json`, all in UTC).

Duplicate sends are prevented by the app (`AutomationReminderLog`), not by the schedule. Every run is recorded in `AutomationRun` and shown at **Admin → Automation**. Retention jobs support dry runs, and the audit-retention job only reports unless it is explicitly called with `dryRun: false`. See **[AUTOMATION_WORKFLOWS.md](AUTOMATION_WORKFLOWS.md)** for every job, its schedule and IST/UTC times. Sub-daily Vercel crons need a Vercel Pro plan.

## Deployment

The live demo runs on Vercel with a Neon Postgres database. **The Vercel project is not git-connected: pushing to GitHub does not deploy.** Migrations are **never** run by the Vercel build (`npm run build` is just `next build`).

Deploy in this order:

1. **Back up production:** `DATABASE_URL="<prod url>" ./scripts/backup-db.sh <dir> 14`.
2. **Apply migrations to production:** `DATABASE_URL="<prod url>" npx prisma migrate deploy`. Never use `prisma db push` or `migrate reset` against a shared database.
3. **Deploy the app:** `npx vercel --prod` (after `vercel login`).

Rollback, backups and the planned Hostinger VPS (Coolify) move are covered in `docs/deployment/DEPLOYMENT_RUNBOOK.md`.

## Go-live checklist

**Integrations Health** (on the Admin → Automation page) runs every go-live check and only allows the **"Go-live ready"** flag once all of them are green:

- [ ] Razorpay, Resend, WhatsApp and Anthropic (OCR) keys set in production; Razorpay webhook pointed at `/api/webhooks/razorpay`.
- [ ] Every WhatsApp notification template has an approved Meta template name (`metaTemplateName`). Approval is done in Meta Business Manager, see `WHATSAPP_SETUP.md`.
- [ ] `systemAlertEmail` set in Admin → System Configuration.
- [ ] **GST stays at 0%** (Admin → Tax & Fees) until the client registers and confirms a GSTIN.
- [ ] Legal details (legal entity, GSTIN, jurisdiction, grievance officer, company name/phone/email) filled in Admin → System Configuration. Blank fields are hidden on the site.
- [ ] All "Sample"/"Test" master data replaced with real data (airports, airlines, borders, vendors, coupons, document requirements, pricing, OTB prices, visa types, templates, FAQs). Airports, Airlines, Borders, Vendors, Pricing Rules and Document Requirements support CSV import with a validation preview.
- [ ] A scheduler secret (`AUTOMATION_API_KEY` or `CRON_SECRET`) set and the scheduler configured.

## Cleaning up test data

`scripts/cleanup-test-data.ts` finds test customers (example-domain / `test+` emails, "Test"/"Sample" names) and everything linked to them, mock-gateway payments (`mock_` refs), and Sample/Test master rows. A master row that is still referenced by real data is deactivated instead of deleted. AuditTrail history is never deleted.

```bash
npx tsx scripts/cleanup-test-data.ts             # DRY RUN (default): report only, changes nothing
npx tsx scripts/cleanup-test-data.ts --confirm   # asks you to type DELETE TEST DATA, then deletes in one transaction
```

With `NODE_ENV=production`, `--confirm` also requires `--i-know-this-is-production`. Always back up first.

## Documentation

- `CLAUDE.md`: project rules, architecture notes and progress log (read first when working on the code)
- `AUTOMATION_WORKFLOWS.md`: background jobs
- `WHATSAPP_JOURNEY.md`: how the WhatsApp bot works (client-facing)
- `DEVELOPMENT_ROADMAP.md`: roadmap
- `docs/deployment/`: `DEPLOYMENT_RUNBOOK.md`, `EMAIL_SETUP.md`, `WHATSAPP_SETUP.md`, `N8N_SETUP.md`
- `docs/brand/`: brand foundation, tokens, asset manifest
- `client-message/`: the client's locked specs (`CRM.md`, `ADMIN.md`, per-service documents, audit reports)
- `docs/*.docx`: client developer handovers
