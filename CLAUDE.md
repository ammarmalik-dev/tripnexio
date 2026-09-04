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
Premium travel look at or above the quality of Atlys.com and Visa2fly.com. **Light-first base** — warm-white/white content surfaces with dark-navy text, confirmed against both `docs/brand/Brand_Foundation.md` §13 (Glass 01/02/03 are explicitly white-based, `rgba(255,255,255,.86/.92/.96)`; dark glass is called out as needing "its own validated treatment," i.e. the exception, not the default) and the client-approved reference (`BRAND ASSEST/refrence-desgin-home.webp`, verified by pixel-sampling, not just eyeballing). Glassmorphism (backdrop blur, soft 1px navy-tinted borders, layered translucent white surfaces), a refined electric-blue accent gradient for primary CTAs/highlights, and a small number of deliberately dark-navy blocks (footer, bottom CTA banner, "Track Your Journey"-style status cards) for contrast and emphasis — not a sitewide dark theme. Subtle gradient-mesh backgrounds where used, smooth scroll-reveal and hover micro-interactions, clean cards, generous spacing, confident modern typography. Motion should feel alive but tasteful, never gaudy. Mobile and desktop both first-class.

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
Only `/` (`src/app/page.tsx`) exists as a real page today; no other routes are built yet (services/CRM/admin pages are not started). The homepage has been rebuilt end-to-end to match the client-approved reference (`BRAND ASSEST/refrence-desgin-home.webp`) — see Design direction above for the light-first correction. Snapshot of what's in place, so future work builds on the real state instead of re-deriving it:

- **Layout shell** (`src/components/layout/`): `Navbar` (flat link row — Services / How It Works / Track Status / Contact — + a "WhatsApp Support" pill button; mobile-only hamburger opens `SiteDrawer`; no dropdown mega-menu, no login icon, no utility bar above it — those were removed to match the reference). `SiteDrawer` (slide-in panel, flat nav list + contact + socials + "Get Started" CTA). `Footer` (a deliberately dark-navy block — see Design direction — with 4 columns: Company / Services / Support / Legal, sourced from `services-config.ts` + `nav-config.ts`). `Logo` (takes a `variant="onLight" | "onDark"` prop — two brand symbol SVGs exist for this, `tripnexio-symbol.svg` navy and `-dark.svg` white).
- **Home page sections** (`src/app/page.tsx`), in order: (1) Hero — `HeroCarousel` full-bleed photo background (`src/components/motion/HeroCarousel.tsx`, real Unsplash photography via `src/lib/hero-images.ts`, light legibility wash + fade-to-white at the bottom, not a dark scrim, WCAG-2.2.2-compliant pause control) with eyebrow + heading + subtext + "Browse Services"/"Track Status" CTA buttons; (2) `AiAskBar` — a floating white "Ask TripNexio AI" input overlapping the hero/content boundary, routes to `/ai?q=` (no backend yet); (3) `ServicesGrid` — 6 service-module cards (New Visa, Visa Extension, Visa Change, Special Fare Flight, Return Verified Ticket, OTB), `src/lib/services-config.ts`, real sourced Unsplash images; (4) `HowItWorks` — 5-step process; (5) `TrackJourneyPreview` — a dark-navy sample application-status stepper card; (6) `WhyChooseUs` — 6 trust points; (7) `AboutSection` — light card with an inset Burj Al Arab photo; (8) `SupportPayment` — WhatsApp help + secure payment cards + trust badges; (9) `CtaBanner` — dark-navy "Ready to simplify your journey?" block. There is no GCC-destinations grid on the homepage (the earlier `DestinationsGrid`/`DestinationCard`/`destinations-config.ts` and the `flag-icons` dependency were removed when the services grid replaced it) and no tabbed quick-start form (the earlier `QuickStartBar`/`QuickStartForm`/`QuickStartProvider`/scroll-docking-into-navbar system was removed entirely — it doesn't exist in the reference).
- **Design system**: token pipeline in `src/app/globals.css` (raw `--tn-*` brand tokens → semantic tokens → Tailwind `@theme inline`) is **light-first**: `--surface-base/-1/-2` resolve to warm-white/white, the `--ink-*` ramp (`ink-primary/secondary/tertiary/muted`, plus `--ink-heading` and `--ink-accent`) is dark-on-light text, `.glass-1/-2/-3` and `.glass-overlay` are white-based per Brand Foundation §13. A **separate** ramp exists only for the three deliberately dark-navy blocks (footer, CTA banner, journey card): `--ink-on-dark-*`, `--surface-dark`, and the `.surface-dark-block` utility class — reach for those, not the default `--ink-*`/`--surface-*` tokens, when building something that should stay dark. Reusable `Button`/`ButtonLink`/`Container`/`GlassCard`/`SectionHeading`/`SocialIcon` in `src/components/ui/`. `Skeleton`/`EmptyState`/`ErrorState` components exist but aren't wired to real data anywhere yet (there is no dynamic/fetched data on the site yet — everything is static/sample) and still assume the old dark-surface look (`bg-white/[0.04]` etc.) — fix when first wired up.
- **Not yet done** (don't assume these exist): react-hook-form + zod are installed but not used anywhere yet (no real submitting form exists); Prisma/DB/Auth (M2) haven't been started; no other pages beyond `/`; per-page metadata only exists at the root layout level (nothing to override yet since there's only one page); `public/og-image.png` is missing (see Brand section above).
- **Git**: the project is now a git repo (it wasn't for a while — M1 work up to this point had never been committed). Commit after each unit per hard rule #4.
- Verification pattern used throughout: `npx tsc --noEmit`, `npm run lint`, `npm run build` after each unit (trust these over IDE inline diagnostics, which have been stale in this environment), plus a visual check in Chrome. Prefer pixel-sampling (Python/Pillow) over eyeballing when judging fidelity against a reference image — a small/compressed reference is easy to misread by eye (see how the light-vs-dark theme call above was actually settled). Mobile-viewport resizing via the Chrome tool has been unreliable in this environment (screenshots kept rendering at desktop width regardless of the requested size) — mobile layout has not had a real visual pass yet, only the desktop viewport has.

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

Logo: partial. The source PDF only gave a machine-readable **symbol** SVG, not a full wordmark/lockup — both `public/brand/tripnexio-symbol.svg` (navy, for light backgrounds) and `-symbol-dark.svg` (white, for dark backgrounds) are in use via `Logo.tsx`'s `variant` prop, rendered as symbol + text "TripNexio". Full wordmark/lockup SVGs, a horizontal/stacked lockup, and additional monochrome variants are still TODO (client to send, or approve deriving them from the PDF). Do not fabricate these — see `docs/brand/BRAND_ASSET_MANIFEST.md` for exactly what was and wasn't reproduced from the source PDF.

Still TODO: `public/og-image.png` (referenced by `siteConfig.ogImage` in metadata but not yet created).
