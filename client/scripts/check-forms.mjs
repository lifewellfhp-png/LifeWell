/**
 * End-to-end form test: real browser -> Next.js frontend -> Node API.
 *
 * Local-only, by design: this script issues real POST /api/contact and
 * POST /api/newsletter requests, so it must never run against production —
 * doing so would submit a genuine contact request and newsletter signup
 * every run. There is no check-forms.mjs "prod" variant; see
 * check-deeplinks.prod.mjs for how a read-only production script looks.
 *
 * Requires both servers running:
 *   server/  npm start   (port 4000)
 *   client/  npm start   (port 3000)
 *
 *   npm run check:forms
 */
import { chromium } from 'playwright';
import { SITE_BASE as SITE, API_BASE as API, preflight } from './lib/site-config.mjs';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

if (/lifewellfhp\.com|lifewellfhp-server\.vercel\.app|vercel\.app/.test(SITE + API) && !/localhost|127\.0\.0\.1/.test(SITE)) {
  console.error(
    'REFUSING TO RUN: check-forms.mjs submits real form data and must only target a local server.\n' +
      `SITE_BASE (${SITE}) or API_BASE (${API}) looks like production/a deployed host.\n`
  );
  process.exit(2);
}

await preflight({ requireSite: true, requireApi: true });

const health = await fetch(`${API}/health`).then((r) => r.json());
console.log(`API health: ${health.status} (mail: ${health.integrations.mail})\n`);

const browser = await chromium.launch();
const page = await browser.newPage();

/** Waits until React has hydrated and the form is interactive. */
async function ready(locator) {
  await locator.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------- contact form --- */

console.log('Contact form');
await page.goto(`${SITE}/contact-telehealth-mental-health-provider`, {
  waitUntil: 'domcontentloaded',
});

// The footer newsletter also has an email field, so scope to the contact form.
let contactForm = page.locator('form').filter({ has: page.getByRole('button', { name: /send message/i }) });

// Client-side validation must block an empty submit. The deployed contact
// form is ContactForm's "compact" variant (see ContactPageContent.tsx and
// CTASection.tsx — both pass variant="compact"; "full" is not rendered
// anywhere in the app), which has exactly 3 required fields: Name, E-mail,
// Reason. Phone is full-variant-only and never rendered here; there is no
// consent checkbox in compact mode because compact submissions send
// consent: true unconditionally (see ContactForm.tsx's onSubmit).
await ready(page.getByRole('button', { name: /send message/i }));
await page.getByRole('button', { name: /send message/i }).click();
await page.waitForTimeout(300);
const clientErrors = await page.locator('[id$="-error"]').count();
record('client-side validation blocks empty submit', clientErrors === 3, `${clientErrors} field errors (expected 3: name, email, reason)`);

const requestSeen = { hit: false, body: null };
page.on('request', (req) => {
  if (req.url().includes('/api/contact') && req.method() === 'POST') {
    requestSeen.hit = true;
    try {
      requestSeen.body = JSON.parse(req.postData() ?? '{}');
    } catch {
      requestSeen.body = null;
    }
  }
});

await contactForm.getByLabel('Name', { exact: true }).fill('Playwright Tester');
await contactForm.getByLabel('E-mail', { exact: true }).fill('tester@example.com');
await contactForm.getByLabel('Reason', { exact: true }).selectOption('scheduling');
await page.getByRole('button', { name: /send message/i }).click();

await page.waitForTimeout(1500);

record('POST /api/contact issued from the browser', requestSeen.hit);
record(
  'payload carries the entered values',
  requestSeen.body?.name === 'Playwright Tester' &&
    requestSeen.body?.reason === 'scheduling' &&
    requestSeen.body?.consent === true,
  requestSeen.body ? `name="${requestSeen.body.name}" reason="${requestSeen.body.reason}"` : 'no body'
);
record(
  'honeypot field sent empty',
  requestSeen.body?.company === '',
  `company=${JSON.stringify(requestSeen.body?.company)}`
);

const success = await page.getByRole('status').isVisible().catch(() => false);
const successText = success ? await page.getByRole('status').innerText() : '';
record('success state rendered', success, successText.split('\n')[0]?.slice(0, 60));

const canResend = await page.getByRole('button', { name: /send another message/i }).isVisible();
record('offers to send another message', canResend);

/* ---------------------------------------------------- newsletter form --- */

console.log('\nNewsletter form');
await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' });

// FooterNewsletter (the only NewsletterForm instance in the app — see
// Footer.tsx) renders collapsed by default: just a "Sign up to Newsletter"
// toggle button. The email input doesn't exist in the DOM until that's
// clicked, so the field must be revealed before it can be located.
const newsletterToggle = page.getByRole('button', { name: /sign up to newsletter/i });
await newsletterToggle.scrollIntoViewIfNeeded();
await ready(newsletterToggle);
await newsletterToggle.click();

const newsletterInput = page.locator('input[name="email"]').first();
await ready(newsletterInput);

// Invalid address is caught before any request goes out.
let newsletterRequests = 0;
page.on('request', (req) => {
  if (req.url().includes('/api/newsletter')) newsletterRequests += 1;
});

await newsletterInput.fill('not-an-email');
await page.getByRole('button', { name: /^sign up$/i }).click();
await page.waitForTimeout(400);
record('invalid email blocked client-side', newsletterRequests === 0, `${newsletterRequests} requests`);

const inlineError = await page.locator('text=Please enter a valid email address.').first().isVisible();
record('inline error shown', inlineError);

await newsletterInput.fill('subscriber@example.com');
await page.getByRole('button', { name: /^sign up$/i }).click();
await page.waitForTimeout(1500);

record('valid email triggers request', newsletterRequests >= 1, `${newsletterRequests} requests`);

const subscribed = await page
  .locator('text=please check your inbox')
  .first()
  .isVisible()
  .catch(() => false);
record('subscription success state rendered', subscribed);

/* ---------------------------------------------------- error handling --- */

console.log('\nError handling (API unreachable)');
await page.route('**/api/contact', (route) => route.abort('failed'));
await page.goto(`${SITE}/contact-telehealth-mental-health-provider`, {
  waitUntil: 'domcontentloaded',
});
contactForm = page.locator('form').filter({ has: page.getByRole('button', { name: /send message/i }) });
await ready(page.getByRole('button', { name: /send message/i }));
await contactForm.getByLabel('Name', { exact: true }).fill('Offline Tester');
await contactForm.getByLabel('E-mail', { exact: true }).fill('offline@example.com');
await contactForm.getByLabel('Reason', { exact: true }).selectOption('scheduling');
await page.getByRole('button', { name: /send message/i }).click();
await page.waitForTimeout(1200);

// Two live regions exist on the page; the contact form's is the first.
const alert = page.locator('[role="alert"]').first();
const alertVisible = await alert.isVisible().catch(() => false);
const alertText = alertVisible ? await alert.innerText() : '';
record('network failure surfaces a friendly error', alertVisible && /could not send/i.test(alertText), alertText.slice(0, 70));
record('no stack trace leaked to the user', !/Error:|at \w+\./.test(alertText));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? '✓ ALL PASS' : `✗ ${failed.length} failure(s)`} — ${results.length} checks\n`
);
process.exit(failed.length === 0 ? 0 : 1);
