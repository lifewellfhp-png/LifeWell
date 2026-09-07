/**
 * Synthetic, harmless fixture content for automated tests of campaign
 * management (delete / duplicate as draft / send test) — campaign
 * management + safe test send.
 *
 * This is NOT a Production campaign and this file never calls the Admin
 * API, never touches Supabase, and never sends an email. It exists only
 * so test-marketing-campaign-management.mjs has a realistic-shaped
 * campaign object to exercise pure functions and source-structure checks
 * against, the same way labor-day-2026-subscriber-greeting.mjs is the
 * canonical content source for the Labor Day campaign's own tests.
 *
 * The name is deliberately unambiguous ("DO NOT SEND") so that if this
 * object were ever accidentally pasted into the Admin UI by a human, its
 * own name would warn against sending it. No PHI, no diagnosis/
 * appointment/medication reference, no urgency language, no discount
 * offer, no testimonial claim, no clinical claim of any kind — this is
 * intentionally inert placeholder content.
 */

export const CAMPAIGN_WORKFLOW_TEST_FIXTURE = {
  name: 'Campaign Workflow Test — DO NOT SEND',
  subject: '{{first_name}}, this is an internal workflow test',
  subject_fallback: 'This is an internal workflow test',
  preview_text: 'Internal workflow test content only — not for subscriber delivery.',
  audience_type: null,
  status: 'draft',
  content: `Hello, {{first_name_or_there}}!

This is placeholder content used only to exercise the campaign management workflow (delete, duplicate as draft, send test) in automated tests. It contains no clinical information and is never delivered to real subscribers.

—
LifeWell Family Health & Psychiatry (internal test fixture)
Unsubscribe: {{unsubscribe_url}}
`,
  html_body: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Campaign Workflow Test</title></head>
<body>
  <p>Hello, {{first_name_or_there}}!</p>
  <p>This is placeholder content used only to exercise the campaign management workflow (delete, duplicate as draft, send test) in automated tests.</p>
  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
</body>
</html>`,
};
