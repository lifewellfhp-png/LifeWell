# Privacy Notes — Third-Party Services

What each third-party script/embed on the LifeWell site receives, and whether it can see health information. This file documents the current, as-deployed state — update it whenever a third-party integration changes.

## Summary

| Service | Loads on | Receives | Can see health info? |
|---|---|---|---|
| CharmHealth | Booking page only | Standard iframe request (IP, user agent, referrer) — no form data is passed from our side | No — we never transmit appointment details or patient data into the iframe URL; whatever the patient enters happens entirely inside CharmHealth's own calendar, which is their system, not ours |
| Gemini (chat assistant) | Every page (chat widget) | The visitor's typed message text, sent to our own server, which forwards it to Gemini | **Only if the visitor types it.** The chat prompt instructs the assistant never to request or store medical information, and a crisis-keyword filter runs before any message reaches Gemini — but like any free-text chat box, a visitor could type health details into it. No transcript is ever stored (see below) |
| YouTube / Vimeo | `/videos` and any page with an embedded video | Standard embed request once the visitor clicks play (youtube-nocookie.com / player.vimeo.com — chosen specifically to avoid tracking before interaction) | No — videos are general educational content, not tied to any patient data |
| Google Maps | Contact page only | Standard embed request (IP, user agent) to render the office location | No |
| Cloudflare Turnstile | Contact/newsletter forms, when configured | Standard bot-check signal (browser fingerprint-style challenge) | No — Turnstile never sees form field contents, only runs its own challenge in an iframe |
| Google Ads | **Not currently live** (see below) | N/A until merged | N/A |

## Detail per service

### CharmHealth (booking)
- Where: `/book-telehealth-mental-health-appointment` only, inside an `<iframe>` pointed at CharmHealth's own public calendar URL.
- What it receives: a standard iframe page load — IP address, user agent, and the fact that the referring page was ours. Nothing about the visitor's reason for booking, symptoms, or any other health detail is included in that request; everything the patient enters afterward happens inside CharmHealth's own interface, under CharmHealth's own privacy practices, not ours.
- Tracking: our side only fires a non-PII `booking_click` conversion event (button click + path, no form data) when a "Book an Appointment" button is clicked — this is sent to our own server, not to CharmHealth.

### Gemini (chat assistant)
- Where: the chat widget, present on every page.
- What it receives: whatever text the visitor types into the chat box, sent from the browser to our own Express server (`/api/chat`), which then calls the Gemini API with that message plus a system prompt that explicitly instructs the model never to request or discuss medical/clinical information and to redirect anything clinical to booking or a callback.
- Crisis safety: a deterministic keyword filter runs **before** any message reaches Gemini — a crisis-language message gets a fixed response (988/911/office phone) and never leaves our server at all.
- Storage: **no chat transcript is ever written to our database.** Server-side request logging only records method/path/status — never the message body. Error logs only ever include narrow, named metadata, never the parsed request.
- Caveat: because this is a free-text input, a visitor *could* choose to type health information into it, the same way they could type it into any web form. The UI and system prompt both actively discourage this, but it isn't technically prevented at the input level the way the contact form's fixed fields are.

### YouTube / Vimeo
- Where: `/videos` and anywhere a video is embedded.
- What it receives: a standard embed request only once a visitor clicks play — both are loaded via their privacy-enhanced/no-cookie domains (`youtube-nocookie.com`, `player.vimeo.com`) specifically so no tracking cookie is set just from the page loading.
- Health info: none — these are general wellness/educational videos, never tied to a specific patient or visit.

### Google Maps (contact page)
- Where: `/contact-telehealth-mental-health-provider` only.
- What it receives: a standard map-embed request (IP, user agent) to render the office location pin. No visitor-specific or health data is included.

### Cloudflare Turnstile (bot protection)
- Where: the contact form and newsletter signup form, **when configured** (see status below).
- What it receives: Turnstile's own invisible/lightweight challenge — it verifies the browser is likely human, but never sees the form's field contents (name, email, message, etc.); that data goes to our own server directly, not through Turnstile.
- **Current status: not configured in Production** (confirmed via a production diagnostic — neither the server secret key nor the client site key exist in Production environment variables). The contact/newsletter forms currently rely on the honeypot field alone for bot protection until Turnstile keys are added.

### Google Ads (conversion tracking)
- **Not currently live.** Client-side environment variables for Google Ads IDs/conversion labels are configured in Production, but the corresponding code (`feature/google-ads-conversion-tracking` branch) is not merged, and the CSP does not yet allow Google Ads' script/connect domains. No `gtag`/Google Ads script loads on the live site today — confirmed by inspecting production page HTML.
- When merged: this file must be updated with what the tag receives (typically: page views, the same non-PII conversion events already tracked internally — `booking_click`, `phone_click`, `contact` — IP/user agent for ad attribution). The existing code comments in `client/src/middleware.ts` already flag that CSP allowances and this kind of documentation update should land in the same commit as the merge, not before.
- **Consent and page scope**: not yet implemented (nothing to gate, since the tag isn't live). Once merged, the tag must be: (1) kept off condition, service, and booking pages — those are the pages where a visitor's presence most directly implies specific health information, and (2) gated behind a consent mechanism before it loads anywhere else. Both of these need to be true *before* this line is updated to say the tag is live and compliant.

## Forms and chat: patient-facing wording

- The contact form explicitly tells visitors not to include medical information in their message (verified present in production HTML as of this writing).
- The chat assistant's system prompt instructs it never to request, store, or discuss clinical/medical details, and to redirect any such question to booking an appointment or requesting a callback instead.
- Neither the contact form nor the newsletter signup has a free-text field beyond what's needed for an administrative request (name/email/phone/preferred contact method) — this is a deliberate design choice elsewhere in this codebase, not incidental.

## Maintenance

Update this file whenever:
- A new third-party script/embed is added anywhere on the site.
- Turnstile is configured (update its "current status" line above).
- The Google Ads branch is merged (update its section above with the real, live behavior — consent gate, excluded pages, confirmed CSP allowances).
- The chat assistant's model, prompt, or data-handling changes in any way that affects what it receives or stores.
