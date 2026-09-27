# TripNexio Brand Assets — Source Package

Source: uploaded "TripNexio brand identity(1).pdf"

## Approved palette
- Deep Navy: #182A4D
- Electric Blue: #3E6FDB
- Warm White: #F7F5F0
- Ink Black: #111318

## Approved logo guidance
The source PDF shows these approved variants:
- Primary — Light Background
- Primary — Dark Background
- Horizontal
- Stacked
- Symbol only
- Wordmark only
- AI-Powered Travel Platform
- Monochrome
- Reverse white

Clear space: minimum clear space on all sides equals the height of the symbol.
Minimum symbol size: 16px.
Minimum lockup width: 120px.
Favicon/app icon sizes shown: 512 / 192 / 64 / 32px.

## Included production assets
- tripnexio-symbol.svg — exact symbol SVG source reproduced from the source PDF.
- tripnexio-symbol-dark.svg — dark-background symbol variant derived only for symbol use; verify against the approved master asset before production.
- tripnexio-favicon.svg — symbol-based favicon source; export required sizes from the approved symbol.

## Full wordmark/lockup — recreated 2026-09-28, client-approved

The source PDF's full wordmark/lockup variants (Horizontal, Stacked, Wordmark only, Monochrome, Reverse white, Primary Light/Dark) exist in it only as flattened page images, not machine-readable vectors — see "Not fabricated" note below for how this stood before. The client explicitly authorized recreating them ("Logo i have shared you can recreate if you need," 2026-09-27), so the following were built and are now real production assets:

- tripnexio-logo.svg — primary lockup (stacked), navy + ink, light backgrounds.
- tripnexio-logo-dark.svg — primary lockup (stacked), white, dark backgrounds.
- tripnexio-logo-horizontal.svg — horizontal lockup, navy + ink, light backgrounds.
- tripnexio-logo-horizontal-dark.svg — horizontal lockup, white, dark backgrounds (not a named deliverable in the original list, added for parity with the stacked pair since both layouts need a light/dark counterpart).
- tripnexio-logo-stacked.svg — same content as tripnexio-logo.svg (the PDF's own "Primary" treatment IS the stacked layout — see its reference image).
- tripnexio-wordmark.svg — wordmark only, ink black, no symbol.
- tripnexio-logo-monochrome.svg — single ink-black color throughout (no Electric Blue accent), stacked layout.
- tripnexio-logo-white.svg — pure white throughout (no accent color), stacked layout, for dark/navy surfaces.

**How they were built** (so this is auditable, not a black box): the "N" symbol reuses the exact existing `tripnexio-symbol.svg`/`-dark.svg` path data unchanged. The "TripNexio" wordmark was rebuilt as real vector outlines (not live text, since a standalone SVG asset can't rely on a webfont being loaded — see below) from **Inter ExtraBold (weight 800)**, extracted via `opentype.js` from Inter's own static latin-800 font file. Inter was chosen because the PDF's own supplied wordmark mockup visually matches Inter's letterforms closely (rounded terminals, dotted circular tittles on i/N-adjacent glyphs, geometric proportions) and the Brand Foundation doc (`Brand_Foundation.md`'s "Final Figma rules") already establishes Inter as this brand's typeface elsewhere. Layout proportions (symbol-height-to-text-cap-height ratio, horizontal gap, vertical stacking gap) were measured directly off the PDF's own reference images at 600dpi, not guessed. Every variant was rendered and visually compared side-by-side against the corresponding PDF swatch before being accepted.

**Why outlined paths, not live `<text>`:** these files are meant to work as standalone assets (email signatures, social profile images, PDF/invoice headers, partner co-branding, print) where the browser/viewer has no guarantee Inter is loaded — an SVG `<text font-family="Inter">` would silently fall back to a generic system sans-serif almost everywhere it's used outside this website. Outlining the letterforms once, like a real logotype always ships, makes every file pixel-faithful everywhere, forever, independent of font availability. The website's own live header (`src/components/layout/Logo.tsx`) is intentionally NOT changed to use these — it already renders "TripNexio" as real HTML text in the page's own loaded Inter font, which is strictly better for that specific use (accessible, no extra request, inherits any live theming) — these new files are for the *other* contexts a single flat asset is actually needed.

**Not independently re-approved by the client asset-by-asset** — built from the client's own explicit go-ahead to recreate, not from a fresh vector file they supplied. If the client's original designer has the real source files, prefer those; these are a faithful, documented stand-in until/unless that happens.

## Production rule
Do not redesign, redraw, stretch, distort, recolor, or substitute the approved TripNexio logo. (The recreation above is a faithful reproduction of the same approved design, not a redesign — see the build notes.)
