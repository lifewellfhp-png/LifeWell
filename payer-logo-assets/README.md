# LifeWell payer logo asset map

This package supports a standalone payer-logo maintenance update. Phase 16 remains on hold.

| Payer name | Supplied source |
|---|---|
| BH Benefits | `images.jpg` |
| Complete Commercial Insurance | `images (1)33.png` |
| Florida Exchange | `Florida-Exchange-Logo-Black.png` |
| VA Community Care | `va-community-care-insurance-logo.png` |
| Oxford Health Plans | `images.png` |
| First Health | `1771910.webp` |
| Meritain Health | `118298v1v1.jpg` |
| Curative | `Curative-Logo.jpeg` |
| Florida Medicare Group | `FloridaMedicareGroup.png` |
| Florida Medicaid | `OIP.webp` |
| UnitedHealthcare | Extract the light-background official SVG URL referenced in `United Healthcare Logo & Brand Assets (SVG, PNG and vector) - Brandfetch.html`; the HTML file itself must never be shipped as an image asset. |
| Aetna | `Screenshot 2026-09-07 210943.png` |
| Cigna | `Logo.svg` |
| Oscar Health | Prefer `Oscar_Health_logo.svg`; `Oscar_Health_logo.svg.webp` is a fallback duplicate. |
| AvMed | `avmed_logo_stacked_2c.png` |

## Implementation constraints

- Confirm the current approved insurance list before editing and map by stable payer identity, not array position.
- Do not add or remove accepted payers merely because an asset exists.
- Store optimized assets locally in the client public-assets tree; do not hotlink third-party images.
- Prefer supplied SVGs. Preserve transparency and aspect ratio; never stretch, recolor, redraw, or crop logo content.
- Raster assets may be losslessly trimmed and converted to a web-safe format, but the visible trademark must remain unchanged.
- Use a consistent neutral logo-card canvas with `object-fit: contain`, accessible alt text, and explicit width/height.
- Do not display Florida Medicaid, Florida Medicare Group, or another payer as accepted unless the approved site data already identifies it as accepted.
- Preserve Florida-only insurance language and all pricing, CMS authority, booking, FAQ, analytics, campaign, Paubox, Charm, and PHI behavior.
- Do not mutate Production CMS or database content.

## Required verification

- Every currently approved payer has exactly one correct logo.
- No mismatched, duplicated, missing, stretched, clipped, blurry-at-render-size, or broken logo.
- Mobile and desktop grids have consistent card dimensions and no overflow/layout shift.
- Missing assets fail gracefully to the payer name.
- Client typecheck, build, relevant tests, and browser checks pass.
- Review the full diff, commit and push only the scoped logo update, and report SHAs, files, tests, deployment health, and Production mutation count.
