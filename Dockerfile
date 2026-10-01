# TripNexio production image (Hostinger VPS / Coolify, see docs/deployment/VPS_SETUP.md).
# Official Node 22 image: Nixpacks pins Node 22.11, but Prisma 7 needs 22.12+.
FROM node:22-bookworm-slim

# openssl/ca-certificates for Prisma and outbound TLS (Razorpay, Resend, Meta, Anthropic);
# curl for Coolify's container health check.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first so they cache between deploys. postinstall runs
# `prisma generate`, which needs the schema and the Prisma config.
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# Coolify passes the app's environment variables as build args. The build
# reads the database for a few pages; every DB read has a fallback, and
# those pages revalidate at runtime, so a build without DB access still works.
ARG DATABASE_URL
ARG FILE_STORAGE
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Migrations run here, in the NEW container, before the server starts.
# (Coolify's pre-deployment command runs in the OLD container, which still has the old migrations folder.)
# Prisma's own CLI from node_modules (pinned 7.10.0) — never a downloaded `latest`.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec ./node_modules/.bin/next start"]
