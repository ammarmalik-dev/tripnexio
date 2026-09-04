# TRIPNEXIO --- BRAND FOUNDATION + NEXT PHASE REFERENCE

**Version:** 1.0\
**Status:** Brand Foundation approved / Ready for Figma\
**Purpose:** Future reference for the TripNexio design process

------------------------------------------------------------------------

## 1. PURPOSE

This document records the decisions made during the TripNexio Brand
Foundation phase so that future design work stays consistent.

The purpose of this phase was to establish one shared TripNexio visual
language for:

1.  Website / Customer Portal
2.  CRM / Staff Operations
3.  Admin / Control Panel
4.  WhatsApp / Automation / AI interfaces where applicable

The applications must feel like the same TripNexio platform while
keeping their own information architecture and purpose.

**No production coding is part of this phase.**

------------------------------------------------------------------------

# 2. APPLICATIONS --- FINAL DECISION

The TripNexio platform has three primary applications:

## Website

**Purpose:** Customer-facing experience.

## CRM

**Purpose:** Staff / operational workspace.

## Admin

**Purpose:** Configuration, control and governance.

These three applications are FINAL.

Do not reopen the question of whether TripNexio should have Website, CRM
and Admin unless a future product requirement explicitly changes this
architecture.

------------------------------------------------------------------------

# 3. APPLICATION DISTINCTION

The applications share:

-   Brand identity
-   Logo
-   Colors
-   Typography
-   Design tokens
-   Components
-   Accessibility principles
-   Visual language
-   Status semantics
-   Glass vocabulary

They do NOT need to share:

-   Navigation
-   Information architecture
-   Workflows
-   Permissions
-   Screen density
-   Page templates
-   Application-specific patterns

### Website

Customer-focused, more expressive, more spacious.

### CRM

Operational, compact, highly scannable.

### Admin

Control-focused, precise, restrained.

The goal is:

> Same platform, different purpose.

------------------------------------------------------------------------

# 4. BRAND PERSONALITY

TripNexio should feel:

-   Glassy
-   Lightweight
-   Simple
-   Clean
-   Unique
-   Professional
-   Easy to understand
-   Modern
-   Premium
-   Operational
-   Not heavy
-   Not cluttered

The brand should communicate:

-   Trust
-   Speed
-   Clarity
-   Control
-   Simplicity
-   Professionalism
-   Travel
-   Reliability

Avoid:

-   Childish UI
-   Generic SaaS appearance
-   Generic CRM appearance
-   Generic banking software
-   Gaming UI
-   Excessively futuristic UI
-   Excessive decoration
-   Visual noise

------------------------------------------------------------------------

# 5. APPROVED LOGO SYSTEM

The supplied final TripNexio identity is the source of truth.

Approved asset families include:

-   Primary logo / wordmark
-   Symbol
-   Symbol dark / reverse treatment
-   Favicon
-   App-icon treatment
-   Other official supplied variants

## Logo rules

DO:

-   Use the supplied official assets.
-   Preserve proportions.
-   Preserve colors.
-   Use the correct light/dark version.
-   Respect clear space.
-   Use the official favicon/symbol for small surfaces.

DO NOT:

-   Redraw the logo.
-   Recreate the wordmark using Inter.
-   Stretch or distort it.
-   Add gradients.
-   Change the symbol.
-   Change the blue dot.
-   Invent another logo.
-   Use generated logo artwork as the official source.

The logo itself provides an important part of TripNexio's identity.

------------------------------------------------------------------------

# 6. APPROVED BRAND COLORS

These are locked brand colors:

  Token           Value
  --------------- -----------
  Deep Navy       `#182A4D`
  Electric Blue   `#3E6FDB`
  Warm White      `#F7F5F0`
  Ink Black       `#111318`

CSS reference:

``` css
:root {
  --tripnexio-deep-navy: #182A4D;
  --tripnexio-electric-blue: #3E6FDB;
  --tripnexio-warm-white: #F7F5F0;
  --tripnexio-ink-black: #111318;
}
```

These four colors are the brand foundation.

They are NOT the complete product UI palette.

The Figma design system will add semantic and neutral tokens around
them.

------------------------------------------------------------------------

# 7. UI COLOR SYSTEM

The UI layer uses:

-   Neutral ramp
-   Blue ramp
-   Success
-   Warning
-   Error
-   Info
-   Text tokens
-   Surface tokens
-   Border tokens
-   Focus tokens

Important rule:

`#3E6FDB` remains the official brand blue.

It should not be forced to mean every possible interaction or status.

For small interactive text on Warm White, use the darker blue UI ramp
where necessary for accessibility.

Status colors must never be the only way meaning is communicated.

Use:

-   Text
-   Icon where useful
-   Color

together.

------------------------------------------------------------------------

# 8. TYPOGRAPHY

## UI font

**Inter** is the approved UI typography direction.

Use Inter for:

-   CRM
-   Admin
-   Website UI
-   Forms
-   Tables
-   Navigation
-   Buttons
-   Data
-   Numbers

## Logo typography

The official TripNexio wordmark remains the supplied logo asset.

Never recreate the logo using Inter.

## Website display font

A second display font is NOT mandatory.

Start with Inter.

Only introduce another display face in the future if an actual Website
visual validation proves it is needed.

------------------------------------------------------------------------

# 9. TYPOGRAPHY SCALE

## Website

-   Display: 48--56px
-   H1: 40--48px
-   H2: 28--32px
-   H3: 20--24px
-   Body Large: 16--18px
-   Body: 14--16px

## CRM / Admin

-   Page title: 20 / 28
-   Section: 14--16 / 20--24
-   Body: 14 / 20
-   Table: 13 / 18
-   Metadata: 12 / 16
-   Status: 12 / 16, weight 500
-   KPI: 28--32 / 36--40

13px is an operational table floor, not a reason to keep reducing
typography.

------------------------------------------------------------------------

# 10. SPACING

Base unit:

**4px**

Core scale:

``` text
4
8
12
16
20
24
32
40
48
64
80
96
```

Grid:

-   Desktop: 12 columns
-   Tablet: 8 columns
-   Mobile: 4 columns

Operational default card padding:

**16px**

Website feature cards may use:

**24--32px**

depending on context.

------------------------------------------------------------------------

# 11. TABLE DENSITY

Operational table defaults:

-   Compact: 36px row
-   Default: 40px row
-   Comfortable: 44px row

CRM/Admin should optimize for scanning and operational productivity.

Do not make tables visually dense by unnecessarily shrinking text.

------------------------------------------------------------------------

# 12. RADIUS SYSTEM

Initial shared radius tokens:

  Token           Value
  ------------- -------
  radius-xs         4px
  radius-sm         8px
  radius-md        12px
  radius-lg        16px
  radius-xl        24px
  radius-pill     999px

Use larger radius values selectively.

Avoid oversized rounded cards everywhere.

------------------------------------------------------------------------

# 13. GLASS SYSTEM

Glass is a hierarchy tool.

It is NOT decorative transparency.

## Glass 01

-   Surface: approximately `rgba(255,255,255,.86)`
-   Blur: 8px
-   Border: `1px rgba(24,42,77,.08)`
-   Shadow: `0 2px 12px rgba(17,19,24,.03)`

Use for:

-   Navigation surfaces
-   Subtle panels
-   Selected surfaces

## Glass 02

-   Surface: approximately `rgba(255,255,255,.92)`
-   Blur: 12px
-   Border: `1px rgba(24,42,77,.10)`
-   Shadow: `0 8px 24px rgba(17,19,24,.06)`

Use for:

-   Featured cards
-   Floating panels
-   Website emphasis

## Glass 03

-   Surface: approximately `rgba(255,255,255,.96)`
-   Blur: 20px
-   Border: `1px rgba(24,42,77,.12)`
-   Shadow: `0 20px 48px rgba(17,19,24,.10)`

Use for:

-   Modals
-   Drawers
-   Command/floating surfaces

## Glass rules

-   Do not sacrifice readability.
-   Dense tables should remain solid/high opacity.
-   Dense forms should remain solid/high opacity.
-   Avoid glass-on-glass stacking.
-   If glass reduces contrast, increase opacity or remove glass.
-   Dark glass requires its own validated treatment.

Application usage:

**Website:** most expressive\
**CRM:** selective\
**Admin:** minimal

------------------------------------------------------------------------

# 14. SIGNATURE VISUAL LANGUAGE

TripNexio should have a recognizable visual identity beyond simply using
navy + blue.

The core concept is:

**Connection → Movement → Destination**

This comes from the visual character of the TripNexio symbol and its
blue destination point.

Use this concept subtly in:

-   Timelines
-   Progress indicators
-   Status journeys
-   Meaningful loading
-   Empty states
-   Key Website journey moments

Do NOT:

-   Put route graphics everywhere.
-   Use airplanes as generic decoration.
-   Use passport/globe graphics everywhere.
-   Turn every card into a travel illustration.

The signature should feel like TripNexio, not like generic travel
software.

------------------------------------------------------------------------

# 15. COMPONENT SYSTEM

Shared reusable primitives include:

-   Buttons
-   Inputs
-   Selects
-   Search
-   Tabs
-   Dropdowns
-   Checkboxes
-   Radio
-   Switches
-   Date controls
-   Tooltips
-   Cards
-   KPI cards
-   Status badges
-   Alerts
-   Toasts
-   Modals
-   Drawers
-   Pagination
-   Loading
-   Empty
-   Error
-   Confirmation

Shared data/pattern components include:

-   Tables
-   Timeline
-   Document states
-   Passenger / PAX cards
-   Booking status visualization
-   Charts
-   Progress indicators

Avoid creating five unrelated versions of the same basic Card.

Prefer:

> Shared primitive + controlled variants + application-specific
> patterns.

------------------------------------------------------------------------

# 16. COMPONENT STATE CONTRACT

Reusable interactive components should define:

1.  Default
2.  Hover
3.  Active / Pressed
4.  Focus
5.  Disabled
6.  Loading
7.  Error where applicable
8.  Success where applicable

All components should use shared design tokens.

Do not introduce random local colors, radius, shadows or spacing.

------------------------------------------------------------------------

# 17. STATUS SYSTEM

The design system supports semantic status categories:

-   Neutral
-   Info
-   Active
-   Success
-   Warning
-   Error

These are visual categories only.

Business/service-specific status names are NOT defined by this Brand
Foundation.

Status meaning must not depend on color alone.

------------------------------------------------------------------------

# 18. DATA VISUALIZATION

TripNexio charts should be:

-   Clean
-   Lightweight
-   Readable
-   Restrained
-   Consistent

Rules:

-   Electric Blue can be the primary series.
-   Related navy/blue tones can be secondary.
-   Semantic colors should communicate semantic status.
-   Avoid rainbow charts.
-   No 3D charts.
-   No decorative chart shadows.
-   Avoid heavy gradients.
-   Prefer simple lines, bars, areas and progress visuals.
-   KPIs should carry the main numeric emphasis.
-   Use sparklines when a full chart is unnecessary.

State/progress visualization is especially relevant to TripNexio.

------------------------------------------------------------------------

# 19. ACCESSIBILITY

Required principles:

-   Readable contrast
-   Visible focus states
-   Clear labels
-   Adequate touch targets
-   Icons are not the only meaning
-   Status is not communicated only through color
-   Forms have understandable validation
-   Modals/drawers support focus management
-   Reduced-motion support
-   Glass must not reduce readability

Target:

**44px minimum interactive area on touch devices.**

------------------------------------------------------------------------

# 20. MOTION

Motion should be subtle and operationally useful.

Starting timing:

-   Fast feedback: 120--160ms
-   Standard transitions: 180--220ms
-   Modal/drawer: 200--240ms

Use:

-   Ease-out for entrances
-   Ease-in for exits

Avoid:

-   Continuous decorative animation
-   Excessive bouncing
-   Constant floating
-   Motion that communicates nothing

Respect reduced-motion preferences.

------------------------------------------------------------------------

# 21. WEBSITE / CRM / ADMIN VISUAL CONTRACT

## Website

Customer-focused.

Use:

-   More expressive layout
-   More generous spacing
-   More glass
-   Selective imagery
-   More visible journey language
-   More expressive motion

Priority:

**Customer clarity and confidence**

## CRM

Staff operational workspace.

Use:

-   Compact layout
-   Dense but readable tables
-   Mostly solid surfaces
-   Selective glass
-   Minimal imagery
-   Minimal motion

Priority:

**Speed, scanning and staff productivity**

## Admin

Control/configuration environment.

Use:

-   Precise layouts
-   Structured tables/forms
-   Mostly solid surfaces
-   Minimal decorative glass
-   Minimal motion
-   Strong hierarchy

Priority:

**Accuracy, governance and control**

------------------------------------------------------------------------

# 22. IMPORTANT PRODUCT BOUNDARY

The Brand Foundation does not invent business functionality.

Business requirements remain controlled by the approved
functional/product documents.

Brand Foundation does NOT define:

-   Service-specific statuses
-   Pricing rules
-   Refund formulas
-   Permission logic
-   Integrations
-   Operational business rules
-   Application workflows

Those belong to the appropriate product/functional documents.

------------------------------------------------------------------------

# 23. WHAT IS NOW FINAL

The following are considered approved for the next phase:

-   Website / CRM / Admin architecture
-   TripNexio brand direction
-   Official logo identity
-   Brand colors
-   Inter-first UI typography
-   Lightweight glass direction
-   Journey / Route identity language
-   Shared design-system philosophy
-   Website / CRM / Admin visual distinction
-   Accessibility principles
-   Component philosophy
-   Responsive principles

------------------------------------------------------------------------

# 24. WHAT HAPPENS NEXT

We should now move to **Figma**.

Do NOT create another duplicate architecture document unless a product
requirement changes.

The Figma file should become the visual/product-design source of truth.

Recommended Figma foundation:

``` text
00 — Cover & Principles

01 — Brand Assets
02 — Colors
03 — Typography
04 — Spacing & Layout
05 — Glass & Elevation
06 — Components
07 — Status & Data Visualization
08 — Responsive & Accessibility

09 — Website Shell
10 — CRM Shell
11 — Admin Shell

12 — Review / Approval
```

------------------------------------------------------------------------

# 25. FIGMA ORDER

The recommended execution order is:

``` text
Brand Foundation
        ↓
Figma Design Tokens
        ↓
Shared Components
        ↓
Website Shell
        ↓
CRM Shell
        ↓
Admin Shell
        ↓
Full Website Design
        ↓
Full CRM Design
        ↓
Full Admin Design
```

Do not jump directly into random application screens.

First establish the shared visual system in Figma.

------------------------------------------------------------------------

# 26. FUTURE REFERENCE RULE

Whenever future design work begins, check this document first.

If a proposed design conflicts with this reference:

1.  Check whether it is a genuine product requirement.
2.  If it is a product requirement, the functional document takes
    priority for functionality.
3.  If it is purely visual, keep the shared Brand Foundation unless
    there is a deliberate approved change.
4.  Do not create parallel palettes or duplicate design systems.

------------------------------------------------------------------------

# 27. SOURCE-OF-TRUTH HIERARCHY

For future TripNexio work:

### Business requirements

Approved functional/product documents.

### Brand identity

Approved TripNexio logo/identity assets and brand tokens.

### Product visual design

Approved Figma.

### Implementation

Approved Figma + approved functional/product documents.

Generated concept images are inspiration/validation only.

They are not the official logo source and not the final product
specification.

------------------------------------------------------------------------

# 28. FINAL STATUS

## TRIPNEXIO BRAND FOUNDATION

**STATUS: APPROVED**

**NEXT: FIGMA**

No production coding yet.

The next major task is to translate this approved foundation into the
Figma Design System and then into Website, CRM and Admin designs.

------------------------------------------------------------------------

**End of TripNexio Brand Foundation + Next Phase Reference**
