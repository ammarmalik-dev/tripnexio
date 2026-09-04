# TripNexio - Project Context

## What this is
TripNexio is a travel and visa services platform. Customers request visa and flight services online. Requests become LEADS in a CRM. Staff process them MANUALLY with vendors/airlines. This is NOT a self-service live-booking engine. There is NO live flight/visa booking API. Do not add one.

## Scope (locked)
Market: India to UAE/GCC only (UAE, Saudi Arabia, Bahrain, Kuwait, Oman, Qatar). NOT worldwide.
Modules: New Visa, Visa Extension, Visa Change (Airport-to-Airport + Border Exit), Flight Special Fare, Return Verified Ticket, OTB, Track Status, Ask TripNexio AI, CRM, Admin.

## Stack
Next.js (App Router) + TypeScript (strict), Tailwind CSS, framer-motion for animation, lucide-react for icons, Prisma ORM + PostgreSQL, Auth.js (NextAuth), zod + react-hook-form for validation, Node. Deployment later on Hostinger VPS (Coolify/Nixpacks).

## Auth
Email/Password + Google OAuth + Guest checkout. NO WhatsApp/SMS OTP. Guests can browse and start requests but must log in to view history/tracking.

## Milestones
M1: Frontend/UI (glassy, animated, responsive). M2: DB + APIs + Auth + CRM core. M3: Admin + RBAC + integrations + deployment.

## Design direction
Premium travel look at or above the quality of Atlys.com and Visa2fly.com. Glassmorphism (backdrop blur, soft 1px light borders, layered translucent surfaces), a deep dark premium base with a refined accent gradient and subtle gradient-mesh backgrounds, smooth scroll-reveal and hover micro-interactions, clean cards, generous spacing, confident modern typography. Motion should feel alive but tasteful, never gaudy. Mobile and desktop both first-class.

## QUALITY STANDARDS (apply to everything)
- TypeScript strict, no `any`. Share zod schemas between client, server, and API. Use react-hook-form on all forms with inline validation.
- Every data view has three states: loading skeleton, empty state, and error state. Never a blank screen.
- Use toast notifications for success/error feedback on all user actions.
- Accessibility: semantic HTML, keyboard navigation, visible focus states, aria labels, sufficient contrast, and respect prefers-reduced-motion (reduce/disable animations when set).
- SEO: per-page metadata and Open Graph tags using the TripNexio socials below. Add sitemap and robots.
- Performance: next/image for images, lazy-load below the fold, optimize fonts, prefer Server Components, use Client Components only where interactivity is needed.
- Security: validate every mutation server-side, enforce RBAC server-side (never rely on hidden UI), rate-limit auth endpoints, sanitize inputs, set secure headers, keep all secrets in env only.
- Error handling: try/catch on all API routes, a consistent error response shape, never leak internals to the client.
- Write every state change to the AuditTrail.
- No hard-coded brand colors anywhere; use design tokens so branding swaps in minutes.
- Reusable components, no duplication.

## Progress so far — Homepage (M1 frontend)
Only `/` (`src/app/page.tsx`) exists as a real page today; no other routes are built yet (services/CRM/admin pages are not started). Snapshot of what's in place, so future work builds on the real state instead of re-deriving it:

- **Layout shell** (`src/components/layout/`): `Navbar` (desktop: logo, center nav that swaps between dropdown nav and a docked compact `QuickStartForm` on scroll via `IntersectionObserver`, login icon + `PanelRightOpen` icon that opens `SiteDrawer`; mobile: hamburger opens the same `SiteDrawer`), `NavDropdown` (mega-menu for UAE Visa / Flights), `SiteDrawer` (slide-in panel, works on both mobile and desktop, accordion nav + contact + socials + "Get Started" CTA), `TopUtilityBar` (phone/email/Track Status/Ask AI/socials strip above the navbar), `Footer` (socials, service links, company links, contact, copyright), `Logo`.
- **Home page sections** (`src/app/page.tsx`): hero only has (1) a `HeroCarousel` full-bleed animated background (`src/components/motion/HeroCarousel.tsx`, real Unsplash photography via `src/lib/hero-images.ts`, WCAG-2.2.2-compliant pause control), (2) eyebrow badge + heading + subtext, (3) `QuickStartBar` (the "UAE Visa / Flights / OTB" tabbed quick-start form, `src/components/quick-start/`, sample-data selects per CLAUDE.md rule #1, routes to `/services/*` with query params — no submission/backend yet), then (4) `DestinationsGrid` — 6 equal-size GCC destination cards (`src/components/home/`) with real sourced Unsplash images + flag badges, linking to `/services/new-visa?country=`. **Nothing below the destinations grid exists yet** — no testimonials, service-highlights, FAQ, or bottom CTA section.
- **Design system**: token pipeline in `src/app/globals.css` (raw `--tn-*` brand tokens → semantic tokens → Tailwind `@theme inline`), `.glass-1/-2/-3` (translucent inline cards) vs `.glass-overlay` (near-opaque, for dropdowns/drawer/modals), reusable `Button`/`ButtonLink`/`Container`/`GlassCard`/`SectionHeading`/`SocialIcon` in `src/components/ui/`. `Skeleton`/`EmptyState`/`ErrorState` components exist but aren't wired to real data anywhere yet (there is no dynamic/fetched data on the site yet — everything is static/sample).
- **Not yet done** (don't assume these exist): react-hook-form + zod are installed but not used anywhere yet (no real submitting form exists — the quick-start bar is a client-side router filter, not a mutation); Prisma/DB/Auth (M2) haven't been started; no other pages beyond `/`; per-page metadata only exists at the root layout level (nothing to override yet since there's only one page); `public/og-image.png` is missing (see Brand section above).
- Verification pattern used throughout: `npx tsc --noEmit`, `npm run lint`, `npm run build` after each unit (trust these over IDE inline diagnostics, which have been stale in this environment), plus a visual check in Chrome at desktop and a mobile-simulated width.

## Hard rules for you (Claude Code)
1. NEVER invent authoritative domain data (airport lists, airline lists, border names, prices, document requirements). Use clearly-labeled SAMPLE data and, when a real list is needed, propose it to me for review before seeding.
2. Work incrementally. Do not one-shot dozens of pages/endpoints. Build a unit, let me review, then continue.
3. All database changes go through Prisma migrations committed to git. No undocumented schema changes.
4. Commit after each working unit.
5. At the end of every response, give me numbered next steps.

## Brand (mostly live — see gaps below)
Company: TripNexio (legal name: TripNexio Travel Studio).
Socials: instagram.com/tripnexio, facebook.com/tripnexio, linkedin.com/company/tripnexio, x.com/tripnexio, threads.net/@tripnexio.
Contact: +91 92381 84005 · info@tripnexio.com · Mumbai, India · WhatsApp https://wa.me/919238184005 (permanent click-to-chat format; client's originally-pasted link was a session/tracking-token FB CTA link, not embedded).
All of the above are live in `src/lib/site-config.ts` and `src/lib/nav-config.ts` — no longer placeholders.

Brand colors: approved and locked, from the client's brand PDF (`docs/brand/`). Deep Navy `#182A4D`, Electric Blue `#3E6FDB`, Warm White `#F7F5F0`, Ink Black `#111318` — wired as the four raw `--tn-*` tokens in `src/app/globals.css`, which the rest of the design-token system derives from. Do not redesign/recolor these.

Logo: partial. The source PDF only gave a machine-readable **symbol** SVG, not a full wordmark/lockup — `public/brand/tripnexio-symbol-dark.svg` is in use (see `Logo.tsx`, rendered as symbol + text "TripNexio"). Full wordmark/lockup SVGs, a horizontal/stacked lockup, and monochrome/reverse variants are still TODO (client to send, or approve deriving them from the PDF). Do not fabricate these — see `docs/brand/BRAND_ASSET_MANIFEST.md` for exactly what was and wasn't reproduced from the source PDF.

Still TODO: `public/og-image.png` (referenced by `siteConfig.ogImage` in metadata but not yet created).
