# Hostinger VPS setup (production)

Decision (2026-10-01): production moves from the Vercel + Neon demo to the
client's Hostinger VPS (2 vCPU, 8 GB RAM, 100 GB NVMe, weekly backups,
dedicated IP), with **PostgreSQL running on the same VPS**. This file is the
concrete, ordered checklist for that move. `DEPLOYMENT_RUNBOOK.md` covers the
general process (migrations, rollback, branch workflow).

**Status (2026-10-01): live at https://tripnexio.com** on server `187.126.116.174`
(Hostinger KVM 2, Mumbai), Coolify 4.3.23 at https://coolify.tripnexio.com (the
client's own admin account; registration is closed). Data was moved from Neon and
every table's row count matched. What actually differed from the plan below:

- **Build pack is the repo's `Dockerfile`, not Nixpacks.** Nixpacks pins Node
  22.11 and Prisma 7 refuses to install below 22.12.
- **Migrations run in the container start command** (`prisma migrate deploy &&
  next start`), not as Coolify's pre-deployment command. Coolify runs that in
  the *old* container, which has the old migrations folder (and on a first
  deploy it is skipped).
- **Health check:** `/api/health` (no DB), `curl` is in the image, start period 90s.
- **Neon runs PostgreSQL 18; the VPS database is 17.** The dump was taken with
  `pg_dump` 18 in plain SQL and loaded with `psql --single-transaction`
  (a custom-format 18 archive can't be read by `pg_restore` 17). The original
  dump is in `/root/backups/` on the server.
- **Hostinger writes `authorized_keys` without a trailing newline**, so the
  Coolify installer glued its key onto the panel-added key's line and Coolify
  couldn't SSH to its own host ("Permission denied (publickey)"). Fixed by
  splitting the line. Check this file after adding any key in the Hostinger panel.
- **Hostinger DNS:** the parked-domain A record had TTL 50, below Hostinger's
  minimum of 60, so editing it failed silently until the TTL was changed.
- Coolify API token for server-side automation: `/root/.coolify-token` (600);
  resource ids: `/root/tripnexio-coolify.ids`. Daily DB backup: 02:30 UTC, 14 kept.

Everything runs under Coolify on the one server:

| Service | How | Rough RAM |
|---|---|---|
| TripNexio (Next.js) | Coolify application from the GitHub repo (Nixpacks) | 0.5–1 GB (2–3 GB briefly while building) |
| PostgreSQL 17 | Coolify database resource, **not exposed to the internet** | 0.5–1 GB |
| n8n | Coolify service (see `N8N_SETUP.md`) | 0.3–0.5 GB |
| Coolify itself | installer | 0.5–1 GB |

## 1. Server basics

1. OS: **Ubuntu 24.04 LTS** (Hostinger panel → OS).
2. Log in with an **SSH key**, not a password. Never paste passwords into chat.
3. Firewall (`ufw`, and Hostinger's panel firewall): allow only 22 (SSH),
   80, 443, and 8000 (the Coolify dashboard, only until a domain + SSL is set for
   it). **Do not open 5432** — Postgres is reached only over Coolify's
   internal Docker network.
4. Updates: `apt update && apt upgrade -y`, enable `unattended-upgrades`.
5. Add 2 GB swap as a safety net for builds.

## 2. Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open `http://<server-ip>:8000`, create the admin account (the client keeps
these credentials), and give the dashboard its own subdomain with SSL
(e.g. `coolify.<domain>`), then close port 8000.

## 3. Domain & DNS

Point the domain at the VPS IP (A records for `@` and `www`, plus the
`n8n.` and `coolify.` subdomains). Coolify issues Let's Encrypt SSL
automatically once DNS resolves. Update `siteConfig.url` in
`src/lib/site-config.ts` to the real domain before go-live (sitemap, OG
tags, links in emails).

## 4. PostgreSQL on the VPS

Coolify → New Resource → Database → **PostgreSQL 17**.
- Leave "Make it publicly available" **off**.
- Coolify generates the user/password. Copy the **internal** connection URL
  into the app's `DATABASE_URL` (step 5) — never into git or chat.
- Postgres 17 so it is at least as new as Neon's, which keeps `pg_dump`/
  `pg_restore` compatible.

## 5. The TripNexio application

Coolify → New Resource → Application → GitHub repo
`ammarmalik-dev/tripnexio`, branch `master`, build pack **Nixpacks**.

- Node 22 (same as CI): set `NIXPACKS_NODE_VERSION=22`.
- Install/build/start use the package scripts (`npm ci` → `postinstall`
  runs `prisma generate` → `npm run build` → `npm run start`), port 3000.
- **Pre-deployment command:** `npx prisma migrate deploy` — migrations are
  applied on every deploy, before the new code starts. They are additive
  (see the runbook), so this is safe.
- Health check path: `/`.

Environment variables (every name is documented in `.env.example`):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Coolify's internal Postgres URL from step 4 |
| `FILE_STORAGE` | `db` — see "Uploaded files" below |
| `STAFF_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET` | copy the values from Vercel (copying keeps staff/customers signed in) or generate new ones (`openssl rand -base64 48`) |
| `AUTOMATION_API_KEY` | new random value, shared with n8n |
| `CRON_SECRET` | not needed on the VPS (Vercel Cron only) — leave unset |
| `RAZORPAY_*`, `RESEND_*`, `WHATSAPP_*`, `ANTHROPIC_API_KEY`, `GOOGLE_*` | real keys from the client; placeholders keep those features off |
| `SEED_ADMIN_PASSWORD` | not needed — the data comes over from Neon (step 6); never seed production |

After changing webhooks' host, update the URLs registered with Razorpay
(`/api/webhooks/razorpay`) and Meta (`/api/webhooks/whatsapp`) to the new
domain, and Google OAuth's redirect URI (`/api/auth/google/callback`).

### Uploaded files

The storage layer writes to `storage/uploads/` inside the container unless
`FILE_STORAGE=db`. A container's disk is thrown away on every redeploy, so
on Coolify use **`FILE_STORAGE=db`**: files go into the `FileBlob` table,
so they:
- survive redeploys,
- are included in every database backup automatically,
- move over from Neon with the rest of the data (the Vercel demo already
  stores its files in `FileBlob`).

Uploads are capped at 8 MB and every document is deleted after the
retention window (P27), so the database stays small. (Alternative: keep
disk storage and mount a Coolify persistent volume at
`/app/storage/uploads` — then that volume must be backed up separately.)

## 6. Moving the data from Neon (one-time)

Do this in a quiet window. Staff should stop working in the demo during it.

1. **Backup first**: `DATABASE_URL=<neon> ./scripts/backup-db.sh` (or the
   read-only JSON dump used for earlier releases). Keep the file offline.
2. Dump Neon in custom format with a Postgres 17 client (e.g. from the VPS:
   `docker run --rm postgres:17 pg_dump "<neon-url>" -Fc --no-owner --no-privileges > neon.dump`).
3. Restore into the empty VPS database (from inside the Coolify network or
   the Postgres container):
   `pg_restore --no-owner --no-privileges -d "<vps-url>" neon.dump`.
   This includes `_prisma_migrations`, so Prisma sees every migration as
   applied.
4. Check: `npx prisma migrate status` against the VPS URL reports up to
   date; row counts of `Customer`, `Lead`, `Booking`, `Payment`, `Document`,
   `FileBlob` match Neon.
5. Deploy the app (step 5), sign in to `/crm/login`, open a lead and a
   document to confirm files load.
6. Only after that: switch DNS/announce the new URL. Keep Neon read-only
   for a couple of weeks as a fallback, then delete it and rotate its
   password.

## 7. Backups (the VPS is now the system of record)

Three layers:
1. **Daily database backup** — Coolify → the Postgres resource → Backups:
   schedule `0 2 * * *`, keep 14. (Or `scripts/backup-db.sh` from the host
   cron, see the runbook §4 — needs `postgresql-client-17` on the host.)
2. **Off-server copy** — backups kept on the same VPS are lost with it.
   Configure Coolify's S3-compatible backup destination (Backblaze B2,
   Cloudflare R2, AWS S3) or `rclone` the backup folder daily to the
   client's Google Drive.
3. **Hostinger weekly backup/snapshot** of the whole server — take a manual
   snapshot before every risky change.

**Test a restore** once during setup (runbook §4) — a backup that has never
been restored isn't proven.

## 8. Scheduled jobs

On the VPS nothing is limited to once a day. Run the `/api/automation/*`
jobs from n8n (`N8N_SETUP.md`, workflows in `n8n/workflows/`) with
`Authorization: Bearer <AUTOMATION_API_KEY>` at their real frequencies:
quote-expiry every 5 minutes; payment-followup, staff-alerts,
sla-escalation, abandoned-quote-coupons hourly; the rest daily (the same
times as `vercel.json`). Point n8n at the app's public HTTPS URL. Check
Admin → Automation after the first day — every job should show a recent
SUCCESS run.

## 9. Go-live check

Admin → Automation → Integrations Health must be all green before setting
the go-live flag: real Razorpay/Resend/WhatsApp/OCR keys, Meta template
names, system alert email, GST 0% until a GSTIN exists, scheduler secret,
and no Sample/Test master rows (clean-up via `scripts/cleanup-test-data.ts`
— run by the client/operator deliberately, it is destructive).
