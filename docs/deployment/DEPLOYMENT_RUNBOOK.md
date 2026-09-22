# Deployment & process governance runbook

This turns the client's confirmed deployment/handover requirements
(`client-message/message.txt`, re-confirmed in `DEVELOPMENT_ROADMAP.md`
Step 31) into an actual checklist. It covers: Git branch workflow, Prisma
migrations, tested backups, rollback, deployment docs, source code/API/env
documentation, setup + training, Admin data export, and 30-day bug support.

**Current status:** the live demo (`https://tripnexio.vercel.app` + a Neon
Postgres database) is a quick-turnaround demo environment for client
testing, explicitly chosen over the agreed Hostinger VPS staging/production
setup to get something in front of the client fast (see git history around
2026-09-20). Everything below describes the **target process** for the real
Hostinger VPS deployment — §7 lists exactly what's still needed from the
client before that migration can happen, and what in this document is
already true today vs. still to be executed once it does.

---

## 1. Git branch workflow

**Not yet in effect** — every commit so far in this repository has gone
directly to `master`, since this has been a single continuous AI-driven
build session with no second reviewer. This is the gap Step 31 originally
flagged. Adopt the following from here on:

- `master` is always deployable — it's what staging/production build from.
- One short-lived branch per unit of work (`feature/<short-name>`,
  `fix/<short-name>`), same granularity as this project's existing
  one-commit-per-unit convention (see `CLAUDE.md` hard rule #4).
- Open a PR into `master` even for a solo review pass — it gives every
  change a diff view and a place for the client (or a future second
  developer) to comment, and keeps a record distinct from the raw commit
  log.
- Tag a release (`vYYYY-MM-DD` or semantic, client's preference) at each
  point actually deployed to production, so a rollback (§4) has an exact
  commit to return to.

## 2. Prisma migrations

**Already followed throughout** — every schema change in this project has
gone through a committed migration file under `prisma/migrations/`, applied
via `prisma migrate deploy` (or, on the handful of occasions this
environment's shadow-database got stuck, via `prisma migrate diff` + manual
apply + `prisma migrate resolve --applied`, itself recorded as a normal
migration — see `project_prisma_dev_shadow_db_drift` in project memory).
Nothing new needed here; keep doing this.

Deploy-time command (already how both the demo and any future VPS
deployment apply schema changes):

```bash
DATABASE_URL="<target-database-url>" npx prisma migrate deploy
```

Never use `prisma db push` against staging/production — it doesn't create a
migration file and bypasses this whole tracked-history requirement.

## 3. Deployment docs

This file plus the existing three:

- `docs/deployment/EMAIL_SETUP.md` — Resend domain/DNS setup.
- `docs/deployment/N8N_SETUP.md` — installing n8n and importing the
  automation workflows.
- `docs/deployment/WHATSAPP_SETUP.md` — Meta WhatsApp Cloud API setup.

Together these are the "deployment docs" and "API/env documentation"
deliverables. `.env.example` is the authoritative list of every environment
variable the app reads, each with a comment saying where the real value
comes from and what happens while it's still a placeholder.

## 4. Backups

`scripts/backup-db.sh` is a real, runnable backup script (not a
placeholder) — timestamped `pg_dump`, gzip-compressed, with retention
pruning:

```bash
DATABASE_URL="<production-database-url>" ./scripts/backup-db.sh /var/backups/tripnexio 14
```

**On the Hostinger VPS**, schedule it daily via cron:

```cron
0 2 * * * DATABASE_URL="postgresql://..." /opt/tripnexio/scripts/backup-db.sh /var/backups/tripnexio 14 >> /var/log/tripnexio-backup.log 2>&1
```

**"Tested backups" means actually restoring one, not just producing the
file.** Do this at least once during initial VPS setup, and after any major
schema change, against a scratch database — never against production:

```bash
createdb tripnexio_restore_test
gunzip -c /var/backups/tripnexio/tripnexio-<timestamp>.sql.gz | psql tripnexio_restore_test
# spot-check row counts / a couple of known records, then:
dropdb tripnexio_restore_test
```

On the current demo environment, Neon takes its own automatic snapshots
(separate from this script) — `scripts/backup-db.sh` still works against
Neon's connection string if an extra manual/offsite copy is ever needed, but
isn't scheduled there today since the demo database isn't the system of
record.

## 5. Rollback

Two independent things can need rolling back — handle them separately, in
this order (app first, database only if the new code's migration is
actually the problem):

**Application code:** redeploy the previous release tag (§1). On Vercel this
is "promote a previous deployment" from the dashard or `vercel rollback`; on
the Hostinger/Coolify VPS target, redeploy the previous git tag through
Coolify the same way any other deployment is triggered there.

**Database:** Prisma migrations in this project are additive by convention
(new tables/columns, not destructive drops/renames — every migration added
in this project so far only ever added). A rollback almost never needs to
reverse a migration; redeploying the previous app code against an already-
migrated database is normally sufficient since the app simply won't read the
new columns. If a migration genuinely must be reversed, restore from the
most recent tested backup (§4) taken before that migration ran — there is no
automatic down-migration tooling in Prisma 7's workflow used here, so a
restore is the real rollback mechanism, not a generated down-script.

## 6. Source code & repository

Full source is in the GitHub repository (`ammarmalik-dev/tripnexio`) with
complete commit history — no separate "final handover zip," the repository
itself is the deliverable. Once the branch workflow (§1) is in effect,
`master` at any tagged release is the exact deployed state.

## 7. What's needed from the client before the real VPS deployment

Per the original scope message, on the client's own account/expense:

- **Domain** (production URL — `siteConfig.url` in `src/lib/site-config.ts`
  is currently the placeholder `https://tripnexio.com`, confirm the real one
  before going live so metadata/sitemap/OG tags aren't wrong).
- **Hostinger VPS** access (or wherever the client decides to host —
  Coolify/Nixpacks per `CLAUDE.md`'s Stack section).
- **WhatsApp API credentials** (Meta token + Phone Number ID) — see
  `WHATSAPP_SETUP.md`.
- **Resend API key** — see `EMAIL_SETUP.md`.
- **Razorpay keys** (`RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET`) — the
  app runs on a mock payment gateway until these are real (see
  `.env.example`).
- Any other paid third-party service the client wants connected.

None of these are guessed or fabricated anywhere in the codebase — every one
of them is a `"TODO: client provides"` placeholder in `.env.example` today,
and the app has a genuinely working fallback (mock gateway / console email /
console WhatsApp / keyword AI) for each one until the real value arrives, so
development and demoing were never blocked waiting on them.

## 8. Setup + basic training

Scheduled once the client's own VPS/domain/credentials (§7) are in hand and
the app is actually deployed there — walking through: the Admin panel
(masters, pricing, staff/roles), the CRM (leads → quotation → booking →
payment → refund lifecycle), and this runbook itself (migrations, backups,
rollback) so the client's team can operate day-to-day without needing a
developer for routine changes.

## 9. Admin data export

Already built (Phase 4D) — `/admin/data-export` streams CSV for customers,
leads, bookings, and payments, gated by the `data.export` permission
(deliberately separate from `masters.manage`).

## 10. 30-day bug support

A post-handover commitment, not something to "build" — starts counting from
the date of the real production handover (§8), not from this demo. Track
reported bugs the same way any other unit of work in this project has been
tracked: as a numbered item, fixed as its own reviewed commit, following the
same verify-then-commit discipline used throughout.
