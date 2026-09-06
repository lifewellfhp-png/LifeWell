/**
 * Canonical content for the "Labor Day 2026 — Subscriber Greeting"
 * campaign draft. This is the SINGLE source of truth for this campaign's
 * fields — the owner-facing creation reference and the automated tests
 * both import from here, so they can never drift apart.
 *
 * This file is data, not a script that runs against Production: nothing
 * here calls the Admin API or touches Supabase. Creating the actual draft
 * row requires an authenticated Admin session (POST /api/admin/marketing-
 * campaigns), which this environment does not have credentials for — see
 * the Phase completion report for the exact owner action required.
 *
 * Content approved verbatim per the campaign brief. No PHI, no diagnosis/
 * appointment/medication reference, no urgency language, no discount
 * offer, no testimonial claim.
 */

export const LABOR_DAY_CAMPAIGN = {
  name: 'Labor Day 2026 — Subscriber Greeting',
  subject: '{{first_name}}, wishing you a restful Labor Day',
  subject_fallback: 'Wishing you a restful Labor Day',
  preview_text: 'A warm Labor Day message from LifeWell Family Health & Psychiatry.',
  // Eligible marketing subscribers only — deliberately no audience_type
  // narrowing (null = every contact with marketing_status = 'subscribed',
  // regardless of audience_type). Narrowing to audience_type: 'subscriber'
  // specifically would incorrectly EXCLUDE a validly-consented
  // 'existing_patient' or 'prospective_patient' contact; audience_type is
  // a segmentation label, never the consent gate itself (see
  // buildRecipientEligibilityFilters in marketingCampaigns.controller.ts).
  audience_type: null,
  status: 'draft',

  content: `Hello, {{first_name_or_there}}!

This Labor Day, we're taking a moment to celebrate the dedication, care, and hard work that strengthen our families and communities.

We hope the holiday gives you an opportunity to pause, recharge, and enjoy meaningful time with the people and activities that matter most to you.

Wishing you a safe, peaceful, and restorative Labor Day.

Warmly,
Lourdie Chachoute and the LifeWell Family Health & Psychiatry team

Thoughtful care for mind and body—virtual across Florida, Massachusetts, and Arizona, with in-person appointments available in Orlando where applicable.

Visit LifeWell: https://www.lifewellfhp.com

—
LifeWell Family Health & Psychiatry
3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828

You are receiving this message because you subscribed to LifeWell marketing updates.
Unsubscribe: {{unsubscribe_url}}
Privacy Policy: https://www.lifewellfhp.com/privacy-policy
`,

  html_body: buildHtmlBody(),
};

function buildHtmlBody() {
  const primary = '#3e7fb1';
  const accent = '#5faf6b';
  const ink = '#2f3b47';
  const muted = '#5b6675';
  const cardBg = '#fffdf8';
  const pageBg = '#eef3f7';

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Happy Labor Day from LifeWell</title>
<style>
  body, table, td { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  body { margin:0; padding:0; width:100% !important; background-color:${pageBg}; }
  table { border-collapse: collapse; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:${primary}; }
  .heading-serif { font-family: Georgia, 'Times New Roman', Times, serif; }
  @media screen and (max-width: 600px) {
    .email-container { width:100% !important; }
    .fluid-padding { padding-left:20px !important; padding-right:20px !important; }
    .stack-heading { font-size:28px !important; line-height:1.2 !important; }
  }
  @media (prefers-color-scheme: dark) {
    .dark-bg { background-color:#111827 !important; }
    .dark-card { background-color:#1c2530 !important; }
    .dark-text { color:#e5e9ee !important; }
    .dark-muted { color:#9aa6b2 !important; }
    .dark-border { border-color:#2b3644 !important; }
  }
</style>
</head>
<body class="dark-bg" style="margin:0;padding:0;background-color:${pageBg};">
  <!-- Preheader (hidden, sets the inbox preview snippet) -->
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${pageBg};opacity:0;">
    A warm Labor Day message from LifeWell Family Health &amp; Psychiatry.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dark-bg" style="background-color:${pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-container" style="width:600px;max-width:600px;">

          <!-- Logo / header (text wordmark -- the repo's only approved logo asset is AVIF-only, which many email clients cannot render reliably, so the brand name is rendered as styled text using the site's own colors for guaranteed compatibility) -->
          <tr>
            <td align="center" style="padding:8px 24px 20px;">
              <span class="heading-serif dark-text" style="font-size:22px;color:${primary};font-weight:700;letter-spacing:-0.3px;">LifeWell</span>
              <span class="dark-muted" style="font-size:13px;color:${muted};display:block;margin-top:2px;">Family Health &amp; Psychiatry</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dark-card" style="background-color:${cardBg};border-radius:20px;border:1px solid #e6e2d8;overflow:hidden;">

                <!-- Understated seasonal ribbon accent -->
                <tr>
                  <td style="height:8px;line-height:8px;font-size:0;background-color:${accent};">&nbsp;</td>
                </tr>

                <!-- Hero -->
                <tr>
                  <td align="center" style="padding:40px 32px 8px;">
                    <div aria-hidden="true" class="dark-muted" style="color:${accent};font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">&#9733;&nbsp;&nbsp;&#9733;&nbsp;&nbsp;&#9733;</div>
                    <h1 class="heading-serif stack-heading dark-text" style="margin:0;font-size:34px;line-height:1.15;color:${primary};font-weight:400;">Happy Labor Day</h1>
                  </td>
                </tr>

                <!-- Personalized greeting + message -->
                <tr>
                  <td class="fluid-padding" style="padding:16px 40px 8px;">
                    <p class="dark-text" style="margin:0 0 18px;font-size:18px;line-height:1.5;color:${ink};font-weight:600;">Hello, {{first_name_or_there}}!</p>
                    <p class="dark-text" style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${ink};">This Labor Day, we&rsquo;re taking a moment to celebrate the dedication, care, and hard work that strengthen our families and communities.</p>
                    <p class="dark-text" style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${ink};">We hope the holiday gives you an opportunity to pause, recharge, and enjoy meaningful time with the people and activities that matter most to you.</p>
                    <p class="dark-text" style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${ink};">Wishing you a safe, peaceful, and restorative Labor Day.</p>
                    <p class="dark-text" style="margin:0 0 4px;font-size:16px;line-height:1.6;color:${ink};">Warmly,</p>
                    <p class="dark-text" style="margin:0 0 28px;font-size:16px;line-height:1.6;color:${ink};font-weight:600;">Lourdie Chachoute and the LifeWell Family Health &amp; Psychiatry team</p>
                  </td>
                </tr>

                <!-- Optional closing line -->
                <tr>
                  <td class="fluid-padding" style="padding:0 40px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef3ef;border-radius:14px;">
                      <tr>
                        <td style="padding:18px 22px;">
                          <p class="dark-muted" style="margin:0;font-size:14px;line-height:1.55;color:${muted};">Thoughtful care for mind and body&mdash;virtual across Florida, Massachusetts, and Arizona, with in-person appointments available in Orlando where applicable.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Secondary, restrained website button -->
                <tr>
                  <td align="center" style="padding:0 32px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius:999px;background-color:${primary};">
                          <a href="https://www.lifewellfhp.com" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:1.2;color:#ffffff;text-decoration:none;font-weight:600;border-radius:999px;min-width:160px;">Visit LifeWell</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Compliance footer -->
          <tr>
            <td class="fluid-padding" style="padding:28px 32px 40px;">
              <p class="dark-muted" style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${muted};text-align:center;">LifeWell Family Health &amp; Psychiatry</p>
              <p class="dark-muted" style="margin:0 0 14px;font-size:13px;line-height:1.6;color:${muted};text-align:center;">3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828</p>
              <p class="dark-muted" style="margin:0 0 10px;font-size:12px;line-height:1.6;color:${muted};text-align:center;">You are receiving this message because you subscribed to LifeWell marketing updates.</p>
              <p style="margin:0;font-size:12px;line-height:1.8;color:${muted};text-align:center;">
                <a href="{{unsubscribe_url}}" style="color:${muted};text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="https://www.lifewellfhp.com/privacy-policy" style="color:${muted};text-decoration:underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
