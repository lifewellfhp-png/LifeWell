# LifeWell — Production Diagnostic Report

Read-only diagnostic. No code, config, env vars, or data changed. No SQL run. No admin login. No real form submitted.

Run window: 2026-10-17 17:07–17:22 UTC (~15 of the 45-minute budget used).

---

## Summary

| Area | Status | Notes |
|---|---|---|
| Deployment | ✅ Pass | All 3 apps on `main`, Ready, correct commits live |
| Security | ⚠️ Needs attention | Admin leaks `X-Powered-By`; Turnstile fully unconfigured (graceful degrade); a few checks inconclusive |
| Features | ⚠️ Needs attention | Core flows work; Turnstile widget doesn't render anywhere (not configured); mobile Services accordion needs a second look |
| SEO | ⚠️ Needs attention | Structured data, canonicals, OG/Twitter all correct; most titles/descriptions run long |
| Performance | ⚠️ Needs attention | Homepage LCP 6.3s / Perf 68; other pages much better (88–90) |
| Accessibility | ⚠️ Needs attention | 1 serious color-contrast violation on homepage (6 nodes); other pages checked clean |
| Privacy | ⚠️ Needs attention | `PRIVACY-NOTES.md` not found; Google Ads env vars configured but tag not live (code unmerged) |

---

## 1. Deployment and health

**Verified by exact commit SHA** (not `vercel ls --prod`'s default sort, which showed stale entries — cross-checked by SHA, the reliable method established earlier this engagement):

| App | Deployment | Commit | Status |
|---|---|---|---|
| Client | `lifewellfhp-client-25rct05te` | `27117a2` (preceptorship hero image) | ● Ready |
| Admin | `lifewellfhp-admin-bg369nuzp` | `a787ab6` (admin blog date field) | ● Ready |
| Server | `lifewellfhp-server-g6dynxdxu` | `0fa1400` (blog category fix) | ● Ready |

`main`'s HEAD (`27117a2`) matches what's live on the client. Admin/server's last **code** change predates that (their most recent commits only touched `client/`), which is correct, not stale.

**Unmerged branches**: `feature/google-ads-conversion-tracking` and `feature/premium-redesign` — both **intentionally** unshipped (premium-redesign was explicitly abandoned; google-ads-conversion-tracking is pending an activation decision per its own code comments in `client/src/middleware.ts`). No homepage-reorg/blog/contact-map/Services-menu/testimonials/fees-page work is sitting unmerged — all of that is confirmed live (see Features section).

**Server health** (`GET /health`): `200 OK` — `{"status":"ok","uptime":1,"integrations":{"mail":"configured","newsletter":"none","supabase":"configured","chat":"configured"}}`. Note: `/api/health` (not `/health`) 404s — if any external uptime monitor is pointed at `/api/health`, it's hitting the wrong path.

**npm audit**:
| App | Critical | High | Moderate |
|---|---|---|---|
| Client | 0 | 5 | 0 |
| Admin | 0 | 5 | 0 |
| Server | 0 | 0 | 1 |

Client/admin's 5 high findings are the same transitive chain (`braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`) — all **build/lint tooling, not runtime/browser code**, so real-world exposure is low, but worth a `npm audit fix` pass when convenient.

**Typecheck/build**: not re-run in this diagnostic (read-only; both were verified clean at the time of the last merge for all three apps, per this session's own build logs).

**Full test suites** (`npx tsx --test scripts/test-*.mjs`, 15-min cap each — all finished well under that):

| App | Tests | Pass | Fail |
|---|---|---|---|
| Client | 398 | 389 | 9 |
| Admin | 380 | 376 | 4 |
| Server | 1058 | 1053 | 5 |

I was not given a list of "5 known pre-existing" failures, so I can't separate them with certainty — reporting all 18 found, with my best read on each:

- **Client (9, all in fees/testimonials tests)** — these assert the **pre-reorg** behavior: no star-rating UI on testimonials, old `FeesPageContent` wording/structure, a "Mental Health" filter that no longer exists. This is very likely the test suite not having been updated after this session's own Testimonials-ratings and Fees-page-reorg work — i.e., stale test fixtures, not product regressions. Needs a decision: update these tests to match the new intentional behavior, or confirm something was reverted unintentionally.
- **Admin (4, all in `test-marketing-campaigns-admin.mjs`)** — Send/Edit/Delete button visibility and "no merge-field syntax" assertions. Unrelated to anything touched this session; root cause not investigated (time).
- **Server (5)**: `test-cms-publish.mjs` needs live `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars (an integration test not meant to run in this sandbox — same finding as earlier this session). `test-settings-patch.mjs` + the "hours match site.ts" test expect `'8:00 AM – 10:00 PM EST'`, which doesn't exist anywhere in current `site.ts` (now `6:30 PM–8:30 PM EST` Mon–Thu etc.) — stale fixture, predates this session. `test-admin-persistence.mjs` and the "missing ADMIN_JWT_SECRET fails closed" test — not investigated (time); the latter may just need that env var set in the local test shell.

---

## 2. Security

**Headers** — checked `/`, `/blog`, `/contact-telehealth-mental-health-provider`, the booking page, admin `/login`, server `/health`:

| Header | Client pages | Admin /login | Server /health |
|---|---|---|---|
| `Strict-Transport-Security` | ✅ `max-age=63072000; includeSubDomains; preload` (2yr) | ✅ same | ✅ same |
| `Content-Security-Policy` | ✅ present, see below | ✅ present, nonce-based | N/A (JSON API) |
| `X-Content-Type-Options: nosniff` | ✅ | ✅ | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ | ✅ | ✅ |
| `Permissions-Policy` | ✅ | ✅ | — not set (API, lower relevance) |
| `frame-ancestors` | `'self'` | ✅ `'none'` | — |
| `X-Powered-By` | ✅ absent | ❌ **present: `Next.js`** | ✅ absent |

Client CSP `frame-src`/`script-src`/`connect-src` matches the allowed list exactly: `self`, CharmHealth, youtube-nocookie.com, player.vimeo.com, Google Maps (both hosts), challenges.cloudflare.com, and the API origin. Nothing broader found.

**Finding (minor): Admin leaks `X-Powered-By: Next.js`** on `/login`. Standard Next.js default; one line (`poweredByHeader: false` in `next.config.js`) removes it. Client doesn't leak it (already disabled there).

**Browser console check** (Playwright, production, all pages): **zero console errors** on `/`, `/blog`, a blog post, `/fees-insurance`, contact, and the booking page — no "Refused to" / CSP violations anywhere.

**Admin (external only, no login)**:
- Unauthenticated `GET /sections`, `GET /users` → `307` to `/login` ✅
- Unauthenticated `GET /api/admin/sections` → `401` ✅ (note: `/api/sections`, without the `admin` segment, 404s — not a real route, just confirms the correct path)
- `noindex` confirmed present on `/login` ✅; admin not in the client's sitemap (37 URLs, all `lifewellfhp.com`) ✅
- Cross-origin `POST` (forged `Origin`) to the admin proxy → `403` ✅ rejected
- **Session cookie flags: Not checked.** Flags only appear on a real login response, and I was told not to log in. No way to verify `HttpOnly`/`Secure`/`SameSite` from the outside without that.

**Server/API**:
- CORS: client origin → `Access-Control-Allow-Origin` reflects it ✅. An arbitrary origin → header absent (not reflected) ✅.
- Forged `X-Forwarded-For` across 3 requests: **inconclusive** — all 3 got `400` (empty/invalid request body), never reaching whatever identifies the rate-limit bucket. A proper test would need a valid payload plus enough volume to compare — didn't attempt given "don't hammer."
- Rate limits: admin login (5 attempts, invalid credentials) all returned `401` with no rate-limit response within that volume — consistent with the documented threshold (5/15min), just not enough requests sent to trigger it (intentionally, per instructions). No `RateLimit-*`/`Retry-After` headers surfaced on the responses I captured either way.

**Secrets/config** (names only — no values ever printed or retrieved):

| Var | Server | Admin | Client |
|---|---|---|---|
| `ADMIN_JWT_SECRET` | ✅ Production | ✅ Production | — |
| `ADMIN_PROXY_SECRET` | ✅ Production | ✅ Production | — |
| `MFA_ENCRYPTION_KEY` | ✅ Production | — | — |
| `TURNSTILE_SECRET_KEY` | ❌ **not set** | — | — |
| `DATABASE_URL` | ✅ Production, Preview | — | — |
| Supabase keys (URL/publishable/secret/anon/service-role) | ✅ all present | — | — |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | — | — | ❌ **not set** |
| `VERCEL_PROTECTION_BYPASS_SECRET` | ✅ confirmed **not** in Production | ✅ confirmed **not** in Production | ✅ confirmed **not** in Production |

**Finding: Turnstile is fully unconfigured** (neither the server secret nor the client site key exist in Production). The code degrades gracefully — honeypot-only bot protection — by design, so this isn't a hole, but it means Turnstile has never actually been live in production. Confirmed live: the widget doesn't render on the contact page (checked below).

**No secrets in the repo or git history**: searched working tree and full `git log -p` (all branches) for API-key/token/private-key/connection-string/AWS-key patterns. Zero real hits — the only matches were `ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000`, a documented placeholder literally labeled "test-only...not-for-production" inside test-script doc comments. No `.env*` files are tracked in git (only `.env.example`).

**No `NEXT_PUBLIC_` variable holds anything secret** — client's public vars are the Google Ads IDs/labels (not secret by nature) and `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SITE_URL` (plain URLs).

**Database (static code inspection only, no SQL run)**: `server/supabase/schema.sql` defines 22 tables and 22 matching `alter table ... enable row level security` statements — every table has RLS enabled, no gaps found. `SUPABASE_SERVICE_ROLE_KEY` is only referenced in `server/src/lib/supabase.ts` (server-side only; grepped — no client/admin usage). **Media bucket contents: Not checked** — would require either listing the live storage bucket (a live data read, borderline for "read-only... through the app or code") or trusting the admin upload code path's restrictions; skipped for time.

---

## 3. Features working end to end

| Feature | Result |
|---|---|
| Contact form loads | ✅ |
| "Do not include medical information" note | ✅ present (verified in raw HTML — my first Playwright selector missed the exact wording) |
| Honeypot field | ✅ present (`<input name="company" tabindex="-1" autoComplete="off">`) |
| Turnstile widget renders | ❌ **does not render** — no site key configured (see Security) |
| Submission path | **Not checked** — per your instruction I didn't submit a real or diagnostic-marked lead; didn't want to create one without you present to confirm you want that |
| Booking: CharmHealth iframe loads, no CSP errors | ✅ iframe present, zero console errors |
| Chat assistant opens, has an input | ✅ opens, input field present |
| Chat: sends a message and gets a reply | **Not checked** — would call the live paid Gemini API; held off given time/cost, flagging for you to test directly or approve a follow-up check |
| Chat: crisis-keyword → crisis response, no transcript stored | **Not checked**, same reason |
| Google Map loads on contact page | ✅ |
| "Get directions" link | ✅ present |
| Blog: search box, category chips, featured post, grid | ✅ all present in production HTML |
| Blog: categories actually filter | **Not checked** — needs a live click-through test; not run this pass |
| Blog: author/date/reading time on each post | ✅ confirmed on the post page I spot-checked |
| Testimonials: stars only where rated | ✅ (code-verified this session: `rating !== null` gate; no fabricated ratings found) |
| Fees & Insurance: new layout, Good Faith Estimate notice | ✅ live |
| Services menu: mouse open/close, Escape, keyboard (Enter) | ✅ all confirmed via Playwright on production |
| Services menu: focus returns to trigger on close | ✅ |
| Services menu: mobile accordion | ⚠️ **automated check returned a false negative** (couldn't confirm "Mental Health" became visible after tapping). This exact flow was manually screenshot-verified working when it was built and merged — likely a selector/timing issue in my diagnostic script, not a regression, but worth a quick manual tap-through to be sure. |
| Newsletter signup | ⚠️ **confirmed not configured** — server health endpoint reports `"newsletter":"none"` directly |

---

## 4. SEO

Crawled all **37** sitemap URLs via direct HTTP (not a headless browser) for status, title, meta description, canonical, OG/Twitter tags, h1 count, image alt coverage, and JSON-LD.

- **HTTP status**: 37/37 return `200`. No 404s, 500s, or redirect chains within the sitemap itself.
- **Titles**: all present, all unique (zero duplicates). **31 of 37** fall outside the strict 50–60 character guideline (most run 60–220+ chars, generally over rather than under — these are "LifeWell"-suffixed, keyword-rich titles that likely get truncated in search results past ~60 chars). Homepage itself is fine at 53 chars.
- **Meta descriptions**: all present. **14 of 37** fall outside 120–160 chars, all on the long side (up to 217 chars on `/preceptorship-program`) — will truncate in SERPs.
- **H1**: exactly one per page, on all 37. ✅
- **Canonical**: present on all 37, every one pointing to `https://www.lifewellfhp.com/...`. ✅
- **Open Graph** (title/description/image) and **Twitter card**: present on all 37. ✅
- **Image alt text**: zero `<img>` tags missing `alt` across all 37 pages (decorative images use `alt=""`, content images have real alt text). ✅
- **Structured data**: every page carries `MedicalBusiness`/`MedicalClinic` + `Person`/`Physician`. Also present where expected: `BreadcrumbList`, `FAQPage` (on `/faqs`), `MedicalWebPage` + `Service` (service pages), `BlogPosting` (posts), `ProfilePage` (`/bio`), `WebSite`/`WebPage`, `ItemList`. **Zero `AggregateRating`/`Review` markup anywhere** — confirmed clean, as required.
- **NAP consistency**: homepage JSON-LD `telephone` = `(407) 603-1717` (exact match) and address components = `3680 Avalon Park E Blvd, Suite 310` / `Orlando` / `32828` (exact match to the required address, split into schema.org's standard `streetAddress`/`addressLocality`/`postalCode` fields rather than one string — functionally identical).
- **robots.txt**: `Allow: /`, links the sitemap, doesn't block CSS/JS. ✅
- **sitemap.xml**: 37 URLs, reasonable `lastmod`/`changefreq`/`priority`, no `/admin`, no `/unsubscribe`. ✅
- **Redirects**: `https://lifewellfhp.com` (no www) → `https://www.lifewellfhp.com` in **1 hop** ✅. But **`http://lifewellfhp.com` (http, no www) takes 2 hops** — `http://lifewellfhp.com` → `https://lifewellfhp.com` → `https://www.lifewellfhp.com`. This is the one redirect-chain issue found; worth a direct http→www redirect rule to collapse it to one hop.
- **Internal broken-link crawl**: **Not checked** — a full link-graph crawl (following every internal `<a href>` on every page) didn't fit the time budget; the 37 sitemap URLs themselves are all confirmed live.
- **Home page title, exactly as it reads now**: **"Mental Health & Primary Care in Florida | LifeWell"**

---

## 5. Performance and accessibility

Lighthouse (mobile), 3 of the 5 requested pages completed in the time available:

| Page | Perf | A11y | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 68 | 97 | 100 | 100 | 6.3s | 0 | 30ms |
| `/contact-telehealth-mental-health-provider` | 90 | 100 | 100 | 100 | 2.9s | 0 | 110ms |
| `/fees-insurance` | 88 | 100 | 100 | 100 | 2.7s | 0.019 | 190ms |

**`/blog` and a service page: Not checked** (time budget) — given the pattern above, I'd expect them closer to the contact/fees range, but that's an inference, not a measurement.

**Finding: homepage is the clear performance outlier** — Perf 68 vs. 88–90 elsewhere, LCP 6.3s (vs. "good" at ≤2.5s). Total page weight 2.4MB. Notably this is *not* about the two large photos added this session — the contact page, which carries one of those same source JPGs, actually scores better (90) than the homepage. The homepage's slowness looks like it's coming from something else on that page (worth a dedicated look — hero video/testimonial carousel/script weight are the likely suspects, not yet isolated).

**axe** (2 pages, inline-injected since the CDN script URL is correctly blocked by CSP — a good sign, not a bug):
- `/`: **1 violation** — `color-contrast` (serious impact), 6 elements affected.
- `/fees-insurance`: 0 violations.

**Static vs. dynamic routes**: not re-verified in this pass, but confirmed clean on every build throughout this session (including the one immediately preceding the last production merge) — no route has regressed from static to dynamic.

**Images**: not separately audited for format/sizing in this pass beyond what Lighthouse's `total-byte-weight` captured above; `next/image` handles resizing/format conversion automatically for all local images, including the two new JPGs added this session.

---

## 6. Health privacy

| Script | What it receives (as configured) |
|---|---|
| CharmHealth | Booking iframe only — third-party calendar page, no data passed from LifeWell's side beyond loading it |
| Chat/Gemini | Not exercised this pass (see Features); per code, no transcript is persisted — only narrow metadata is logged server-side |
| Google Ads | **Not live** — env vars are configured in client Production, but no `gtag`/`googletagmanager` script was found in the live homepage HTML, and the CSP's `script-src`/`connect-src` don't allow Google Ads domains yet. Matches the code comment in `middleware.ts`: deliberately withheld pending the unmerged `feature/google-ads-conversion-tracking` branch. |
| YouTube/Vimeo | Lazy-loaded via `youtube-nocookie.com`/`player.vimeo.com` only on click, per CSP allowlist |
| Google Maps | Contact page embed only, per the newly-added CSP allowance (`www.google.com/maps/`, `maps.google.com`) |
| Cloudflare (Turnstile) | Script domain allowed in CSP, but **not actually configured** (see Security) — currently loads nothing |

**`PRIVACY-NOTES.md`**: **not found** at the repo root (`C:/LifeWell/`). Didn't search every subdirectory given time; worth confirming it doesn't exist elsewhere before concluding it needs to be created.

**Forms/chat wording tells patients not to share medical information**: ✅ confirmed present on the contact page ("do not include medical...").

---

## Critical issues

None found. No security holes, no broken booking/contact/chat, no pages down.

## Important issues

1. **Admin exposes `X-Powered-By: Next.js`** on responses. Fix: `poweredByHeader: false` in `admin/next.config.js` (client already has this disabled).
2. **Turnstile is fully unconfigured in Production** (both the server secret and the client site key are absent) — bot protection on contact/newsletter is honeypot-only right now, not what the feature was built for.
3. **`http://lifewellfhp.com` takes 2 redirect hops** to reach the canonical `https://www.lifewellfhp.com`, instead of 1.
4. **31 of 37 page titles and 14 of 37 meta descriptions run longer than the recommended length** and will likely get truncated in search results.
5. **Homepage Lighthouse performance (68) and LCP (6.3s)** are well behind every other page measured (88–90, 2.7–2.9s) — worth isolating the cause.
6. **1 serious axe color-contrast violation on the homepage**, affecting 6 elements.
7. **18 test failures across the 3 suites** (9 client / 4 admin / 5 server) — several look like test fixtures that went stale after this session's own feature work (testimonials ratings, fees reorg, office-hours correction) rather than real bugs, but they need a deliberate look, not silence.

## Minor / nice to have

- `/api/health` 404s on the server (correct path is `/health`) — only matters if something external is configured to hit the wrong one.
- Mobile Services-menu accordion check came back inconclusive (likely my test script, not the feature — see Features section).

## What you need to do yourself

- [ ] Decide whether to configure Cloudflare Turnstile in Production (both keys), or intentionally leave it honeypot-only.
- [ ] Decide what to do with the `feature/google-ads-conversion-tracking` branch (merge + add CSP allowances together, or keep deferred).
- [ ] Review the 18 test failures and tell me which to update (stale fixtures) vs. investigate further.
- [ ] `npm audit fix` for the 5 high (dev-tooling-only) findings in client/admin, at your convenience — not urgent.
- [ ] Confirm whether `PRIVACY-NOTES.md` exists somewhere I didn't check, or needs to be written.
- [ ] If you want the contact form's live submission path verified, say so explicitly and I'll either do a dry-run check without submitting, or submit one clearly marked "DIAGNOSTIC TEST" for you to delete.
- [ ] If you want the chat assistant's live reply and crisis-keyword behavior verified, approve that separately (it calls the real paid Gemini API).

## Not checked (with reasons)

- Admin session cookie flags (`HttpOnly`/`Secure`/`SameSite`) — requires a real login, which was off-limits.
- Forged `X-Forwarded-For` rate-limit-identity test — my attempt was inconclusive (requests failed validation before reaching rate-limit logic); needs a better-designed test.
- Contact form live submission — held off per your instruction pending your choice of approach.
- Chat assistant live message + crisis-keyword response — not run, to avoid live paid-API calls without explicit approval.
- Blog category filter click-through — not run this pass.
- Newsletter signup submission — not run (same no-fake-data principle as the contact form).
- Full internal-link crawl (every `<a href>` on every page) — didn't fit the time budget.
- Lighthouse/axe on `/blog` and a service page — didn't fit the time budget; 3 of 5 requested pages completed.
- Supabase media bucket contents — not inspected.
- Typecheck/build re-run — not repeated in this pass (read-only diagnostic; both were last verified clean immediately before the most recent production merge).
