# LifeWell Family Health & Psychiatry

A rebuild of [lifewellfhp.com](https://lifewellfhp.com/) — previously WordPress + Elementor — as a
Next.js frontend with a separate Node.js API.

The practice is a **solo telehealth clinic** run by Lourdie Chachoute, FNP-C, PMHNP-BC, offering
psychiatric care and adult primary care entirely by secure video.

---

## Architecture

```text
lifewellfhp/
├── client/                 Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4
│   ├── src/
│   │   ├── app/            Routes, metadata, sitemap, robots, OG image
│   │   ├── components/     ui · layout · sections · forms · seo
│   │   ├── data/           Typed content (site, services, provider, pricing, marketing…)
│   │   │   └── generated/  Produced from the WordPress export — do not hand-edit
│   │   ├── lib/            seo · schema · api client · utils
│   │   ├── styles/         globals.css — the single source of design tokens
│   │   └── types/          Content and API models
│   ├── public/images/      45 assets migrated from the WordPress media library
│   └── scripts/            Content generation + verification suites
│
├── server/                 Node.js · Express · TypeScript · Zod
│   └── src/
│       ├── config/         Environment schema (validated at boot)
│       ├── routes/         /health · POST /api/contact · POST /api/newsletter
│       ├── controllers/    Request handling
│       ├── services/       Email delivery · newsletter provider boundary
│       ├── validation/     Authoritative Zod schemas
│       ├── middleware/     Rate limiting · CORS guard · error handling
│       └── utils/          PHI-redacting logger · typed errors
│
└── _source/                WordPress REST API snapshot (content provenance)
```

**Why a separate `server/`.** The site needs exactly two runtime endpoints, which Next.js Route
Handlers could serve on their own. The split was specified by the client and is kept because it
isolates the only secret-holding surface and leaves room for a future patient portal or EHR
integration. It is a deliberate trade, not an accident.

---

## Getting started

Requires Node 20+.

```bash
# API
cd server
npm install
cp .env.example .env          # runs in log-only mode until SMTP is configured
npm run dev                   # http://localhost:4000

# Frontend (second terminal)
cd client
npm install
cp .env.example .env.local
npm run dev                   # http://localhost:3000
```

### Commands

| Location  | Command                   | Purpose                                              |
| --------- | ------------------------- | ---------------------------------------------------- |
| `client/` | `npm run dev`             | Dev server                                            |
| `client/` | `npm run build`           | Production build (cleans `.next` first)               |
| `client/` | `npm run verify`          | typecheck → lint → contrast → build → link audit      |
| `client/` | `npm run check:contrast`  | WCAG 2.2 audit of the real token values               |
| `client/` | `npm run check:links`     | Audits the built HTML: links, headings, alt, metadata |
| `client/` | `npm run check:responsive`| Chromium sweep, 14 pages × 11 viewports, plus menu, keyboard and search |
| `client/` | `npm run check:forms`     | End-to-end browser → API form tests                   |
| `client/` | `npm run check:coverage`  | Flags source prose the extractor did not capture      |
| `client/` | `npm run check:hero`      | Screenshots the hero and measures heading contrast against the composited video |
| `client/` | `npm run check:deeplinks`| Loads all 41 routes cold, as a browser refresh does  |
| `client/` | `npm run check:vercel`   | Validates every `vercel.json` against Vercel's schema |
| `client/` | `npm run generate:content`| Regenerates content from `_source/`                   |
| `server/` | `npm run dev`             | API with reload                                       |
| `server/` | `npm run build && npm start` | Production API                                     |
| `server/` | `npm run test:api`        | 12 functional API checks                              |

`check:responsive` and `check:forms` need both servers running against a production build.

---

## Content pipeline

Content was recovered from the live WordPress **REST API**, not the supplied crawler export. The
crawl had `html: null` on all 69 records, so it contained no image URLs, no link targets, no
navigation and no footer — roughly 40% of the homepage. The REST snapshot in `_source/` carries
full page bodies, media dimensions and metadata.

`client/scripts/generate-content.mjs` normalises that snapshot into
`src/data/generated/{services,posts,legal}.ts`. Re-run it after any fresh export; do not edit the
generated files directly. Hand-authored content (site details, provider bio, pricing, marketing
copy) lives alongside in `src/data/`.

**Coverage.** The extractor reads headings, paragraphs and lists, so anything Elementor stored in a
bare `<div>` is invisible to it. `npm run check:coverage` measures the gap: services capture
98–100% and legal pages 100%; the only real omission it found site-wide was one sentence on the
testimonials page, now carried in `data/marketing.ts`. Everything else it reports is either the
shared CTA line (already present) or Lorem-ipsum that is deliberately excluded. Re-run it after any
content re-import.

## Hero

Rebuilt to match the original edge-to-edge treatment: the same looping
background footage (`Untitled-design-1.mp4`, 1.1 MB / 26 s / 1920×1080), the
same grey mist texture over it, the same teal tint, and the same two-tone Lora
heading with the practice's pill + arrow-chip calls to action.

Three deliberate differences:

1. **One semantic `<h1>`.** The original split the heading across dozens of
   nested animated `<span>`s, which broke screen readers and text extraction.
   Here it is a single `<h1>` with two coloured spans.
2. **The accent half uses `--color-brand-primary-on-dark` (`#A8D2EF`).** The raw
   brand blue measures **2.21:1** over this footage — unreadable. The tinted
   variant reaches 5.6:1 while still reading as LifeWell blue.
3. **The video is skipped for `prefers-reduced-motion`.** Those visitors get the
   poster frame and the video is never requested. The poster is the LCP paint
   for everyone, so the hero renders before the loop arrives.

`npm run check:hero` screenshots the hero at four widths and samples the
composited pixels behind the heading with the text hidden, so contrast is
measured rather than assumed. It fails below 3:1.

## Site search

The WordPress `?s=` search is replaced by a client-side index (`data/search-index.ts`) derived from
the same typed content the pages render, so it cannot drift. No search API and no runtime index
build; it ships inside the static bundle.

It is a proper combobox — arrow keys move through results, Enter opens the highlighted one, Escape
closes and restores focus, and the result count is announced politely. Cmd/Ctrl-K opens it.
Placeholder-bodied blog posts are excluded from the index.

---

## Design system

Tokens live in one place: `client/src/styles/globals.css`. The palette is the original Elementor
kit, preserved so the site stays recognisably LifeWell.

| Role              | Token                          | Value     |
| ----------------- | ------------------------------ | --------- |
| Brand primary     | `--color-brand-primary`        | `#3E7FB1` |
| Primary (solid)   | `--color-brand-primary-solid`  | `#2F6691` |
| Brand accent      | `--color-brand-accent`         | `#5FAF6B` |
| Accent (CTA fill) | `--color-brand-accent-strong`  | `#3D7A47` |
| Body text         | `--color-text-primary`         | `#374151` |
| Page surface      | `--color-surface-base`         | `#F4F7FA` |

Typography is **Lora** for headings and **Source Sans Pro** for body and UI, self-hosted through
`next/font`.

Three corrections were made to the supplied design system, each documented in `globals.css`:

1. `#3E7FB1` was labelled "Strong Border". It is the primary brand colour and is used as such.
2. `#000000` was given as the base surface. The site's surface is `#F4F7FA`; pure black appears
   nowhere in the brand and would have inverted the whole design.
3. Lora was missing from the supplied fonts. Replacing it with Source Sans Pro would have made the
   brand unrecognisable, so the original pairing is kept.

Solid controls use the darker `#2F6691` / `#3D7A47` variants because white text on `#3E7FB1`
measures 4.31:1 — short of the 4.5:1 required. `npm run check:contrast` verifies all 26 pairs
against the real stylesheet and fails the build on regression.

---

## API

Base URL from `NEXT_PUBLIC_API_URL`.

| Method | Endpoint          | Purpose                    | Limit    |
| ------ | ----------------- | -------------------------- | -------- |
| `GET`  | `/health`         | Liveness + integration state | —      |
| `POST` | `/api/contact`    | Contact form               | 5/hr/IP  |
| `POST` | `/api/newsletter` | Newsletter signup          | 3/hr/IP  |

Both endpoints validate with Zod server-side, strip control characters (blocking email header
injection), carry a honeypot, and return typed JSON. Errors never expose stack traces.

No `GET` content endpoints exist by design — page content is static and compiled into the
frontend. Rebuilding WordPress as an API was explicitly avoided.

### No database

None is required for v1: content is static, booking and payment live in the external EHR, and
there are no user accounts.

> **PHI note.** The contact form can receive protected health information. Submissions are
> validated, forwarded by email, and **never stored** — persisting them would place this service
> in HIPAA scope. The form carries a visible notice asking patients not to include clinical
> detail, and the logger redacts message bodies and contact fields.
>
> Before launch the practice needs a mail provider that will sign a **BAA**. Standard transactional
> providers do not offer one on default plans. Until SMTP is configured the API runs in log-only
> mode and refuses to start a submission in production rather than silently dropping it.

---

## SEO

Metadata is generated from canonical content through `lib/seo.ts`, so no value is duplicated by
hand. Structured data is rebuilt from scratch in `lib/schema.ts`.

Defects carried by the WordPress site and fixed here:

- `/faqs` shipped the Privacy Policy's `<title>` and meta description verbatim
- `/shop` returned HTTP 200, was titled "Page Not Found", and was marked `index, follow`
- The Open Graph image was the 512×512 favicon while declaring `summary_large_image`
- JSON-LD contained double-encoded entities (`LifeWell Family Health &amp; Psychiatry`)
- The homepage was typed as an `Article` authored by the site developer
- `primaryImageOfPage` declared 200×200 for a file that is 150×150
- No blog index existed; nine posts were reachable only via category archives
- 36 of 52 homepage images had empty `alt`, including all 14 insurance logos

Added: `MedicalBusiness` / `MedicalClinic`, `Physician`, `Service`, `FAQPage`, `BreadcrumbList`,
`WebSite`, `WebPage`, with real NAP and `openingHoursSpecification`.

### URLs

All original slugs are preserved, including the long keyword-heavy ones, because they are indexed.
Blog posts keep their root-level paths (e.g. `/managing-anxiety-in-everyday-life`). Clean aliases
(`/about`, `/contact`, `/book`, `/faq`) 301 to the canonical routes. Retired WooCommerce paths
redirect to `/`.

---

## Accessibility

Target: **WCAG 2.2 AA**, verified in a real browser rather than asserted.

- Single `<h1>` per page, no skipped levels — the source used `<h6>` as a visual eyebrow and nested
  `<h2>` beneath `<h3>`
- Headings are plain semantic elements; the source split its `<h1>` across dozens of animated
  `<span>`s, which broke screen readers and text extraction alike
- Visible 3px focus ring on every interactive element
- Mobile menu: focus trap, Escape to close, focus restoration, body-scroll lock without layout shift
- Testimonial carousel has real prev/next buttons — never drag-only (SC 2.5.7)
- Interactive targets meet 24×24 (SC 2.5.8); most reach 44×44
- All motion respects `prefers-reduced-motion`
- Stat counters render their final values server-side, so they are correct without JavaScript

---

## Known content decisions

Recorded here because each one is a judgement call the client should confirm.

| Item | Decision |
| --- | --- |
| **Office hours** | Source published two conflicting sets. The Contact page version is used (it covers all seven days). Bio listed Mon–Thu 18:00–22:00, Fri–Sat 07:00–22:00. **Needs confirmation.** |
| **Booking system** | CharmHealth public calendar is embedded on `/book-telehealth-mental-health-appointment`. SimplePractice is retained in `data/site.ts` but unlinked. |
| **Statistics** | Values were read from the source's own `data-to-value` attributes (5,000 sessions · 1 provider · 15 years · 98% satisfaction · 24/7). The live counters never fired, so every figure rendered as 0. "Licensed Therapists" was relabelled "Licensed Provider" — the practice is solo. **The 5,000-session and 98%-satisfaction claims cannot be verified and should be confirmed or removed.** |
| **Testimonials** | Four genuine testimonials are published. Seven Lorem-ipsum placeholders ("This is item #01…" by "Jon Doe"/"Jane Doe") were dropped. No `Review`/`AggregateRating` schema is emitted, because consent status is unconfirmed. |
| **Blog** | **All nine articles are theme filler** — the "Occidental/European languages" lorem substitute, Goethe's *Werther*, a dental-practice paragraph inside a psychiatry article, and commercial-moving-company copy inside a teen therapy article. Routes are preserved and `noindex`ed; each renders a short placeholder instead of the filler. Removing `needsClientContent` in the generated data publishes a post automatically. |
| **Author attribution** | Source credited health content to "Mohidul Islam" (the developer) and "admin". All content is now attributed to Lourdie Chachoute, PMHNP-BC. |
| **Service description** | The "Follow-Up Visits" card carried teen-therapy copy pasted from another service. Replaced with the opening sentence of that service's own page — the practice's own words, not new copy. |
| **Insurance logos** | All 14 carriers are shown as on the source site, with a qualifier added that coverage varies and should be verified. **Which carriers are genuinely in-network needs confirming.** |
| **Testimonial avatars** | The three source avatar images are absent from the media library. Rather than invent patient photographs, testimonials render with initials. |
| **Copy fixes** | "View All Serices" → "View All Services"; a duplicated "Book Your AppointmentBook Your Appointment" label; Education/Board-certification lists were swapped on the bio page and are paired correctly. |

### Still needed from the client

1. Confirm office hours, booking system, and in-network carriers
2. Verify or drop the 5,000-session and 98%-satisfaction figures
3. Real blog content, or approval to retire the nine posts
4. Written patient consent for the published testimonials
5. A HIPAA-compliant mail provider with a signed BAA
6. Newsletter provider choice (`NEWSLETTER_PROVIDER`)
7. Vector logo source — `logo-footer.svg` was recovered, but the header still uses a 14 KB raster
8. States where the practice is licensed (not stated anywhere on the source site)

---

## Deployment (Vercel)

### Frontend

1. Import the repo, then set **Root Directory → `client`**. Everything else is detected.
2. Add the environment variables below.
3. Deploy.

`client/vercel.json` sets long-lived caching for `/video` and `/images`, and short shared caching
for the sitemap and robots file. Build and install commands are left to Vercel's Next.js preset —
overriding them only creates ways for the deploy to fail.

> Vercel validates `vercel.json` with `additionalProperties: false`, so **any** unrecognised
> top-level key rejects the import — including the `"//"` pseudo-comment convention, since JSON has
> no comment syntax. `npm run check:vercel` validates every config in the repo against Vercel's
> published schema before you push.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes** | The deployed API origin. Left at localhost, the forms fail (gracefully — they show the phone number — but nothing is delivered). |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Drives canonicals, sitemap and JSON-LD. Falls back to `https://www.lifewellfhp.com`; set it per environment so previews don't claim production URLs. |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Optional | Google Ads tag ID (`AW-...`). The tag only loads when this is set. |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_CONTACT` | Optional | Conversion label; fires only after the server confirms the contact form submission succeeded. |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_PHONE_CLICK` | Optional | Conversion label; fires on `tel:` link clicks (the 988 crisis line is excluded). |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_BOOKING_CLICK` | Optional | Conversion label; fires on booking CTA clicks. |

These are read at **build** time and baked in, so changing one needs a redeploy.

Google Ads tag only — no GA4, no GTM, no enhanced conversions. The tag's `config` call sets
`allow_ad_personalization_signals: false`, and every conversion payload sends only `send_to` —
never form fields or other PII.

### Refresh behaviour

Refreshing on a deep link cannot 404 here. That failure belongs to single-page apps on static
hosts, where every path has to be rewritten to `index.html`; Next.js App Router prerenders each
route to its own document, so `/services/psychiatric-evaluations` is a real file. A catch-all
rewrite is deliberately **absent** from `vercel.json` — adding one would shadow the real routes and
break the 404 page.

`npm run check:deeplinks` proves it by loading all 41 routes cold, exactly as a browser refresh
does, and asserting each returns prerendered HTML, that unknown paths 404, and that the legacy
WordPress URLs still redirect.

### API

Two options.

**A separate host (recommended).** Render, Railway or Fly. `npm run build && npm start`. A
long-lived process keeps rate limiting global and lets SMTP connections pool.

**Vercel, as a second project.** Set Root Directory → `server`. `server/vercel.json` and
`server/api/index.ts` route everything to the same Express app, so the paths are unchanged. Note
that rate limiting becomes per-instance under serverless — see the caveats in `api/index.ts`.

Either way set `CORS_ORIGINS` to the deployed frontend origin, `NODE_ENV=production`, and the
`SMTP_*` set. In production the server refuses to accept a submission without SMTP rather than
silently dropping it. `trust proxy` is enabled in production so the rate limiter sees real client
IPs behind the platform's load balancer.

### Notes

- `next/font` fetches Lora and Source Sans Pro at build time, so the build host needs network
  access on a cold cache.
- Dependencies are pinned exactly and `npm ci` reproduces the audited tree.

## Security

`next@15.5.4` — the version this was first built against — carries
[CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478), a **CVSS 10.0 remote code execution** flaw
in the React Server Components protocol that was being actively exploited. Vercel's build log
flagged it as deprecated.

Patched here:

| Package | Was | Now | Why |
| --- | --- | --- | --- |
| `next` | 15.5.4 | **15.5.23** | CVE-2025-66478 (RCE, CVSS 10.0); fixed from 15.5.7 |
| `react` / `react-dom` | 19.1.1 | **19.2.8** | Upstream CVE-2025-55182 |
| `sharp` | 0.34.5 | **0.35.3** | libvips CVEs; pulled in by Next, resolved via `overrides` |
| `postcss` | ≤8.5.22 | **8.5.26** | Source-map path traversal and stringify XSS; via `overrides` |
| `express` | 4.21.2 | **4.22.2** | `body-parser`, `qs`, `path-to-regexp` advisories |
| `nodemailer` | 6.10.1 | **9.0.5** | SMTP command injection and CRLF header injection — directly relevant, since user-supplied name/subject reach the mail transport |

`npm audit` reports **0 vulnerabilities** in both packages. `sharp` and `postcss` use `overrides`
rather than a major-version jump, because `npm audit fix --force` wanted to move to Next 16.

If the site was deployed and publicly reachable on the vulnerable version, rotate any secrets it
held, per Vercel's advisory.
