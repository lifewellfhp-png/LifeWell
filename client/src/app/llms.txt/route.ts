import { NextResponse } from 'next/server';
import { site } from '@/data/site';
import { getResolvedContent } from '@/lib/cms-resolve';

export const dynamic = 'force-dynamic';

/**
 * llms.txt (llmstxt.org) — a plain-text summary of the site intended to
 * help an AI assistant answer questions about it accurately. Built from
 * the same resolved content every page already renders from
 * (getResolvedContent()), so it can never drift out of sync with what's
 * actually live — never hand-maintained, never a second copy of these
 * facts.
 *
 * IMPORTANT: this is optional and experimental. As of this writing, no
 * major AI provider (OpenAI, Anthropic, Google, Perplexity, Microsoft)
 * has publicly confirmed that it reads or relies on llms.txt for any
 * product. It costs nothing to publish and may help some tools some
 * day; it is not a dependable visibility mechanism on its own — see
 * robots.ts (explicit crawler allow-rules) and the structured data in
 * lib/schema.ts for the parts of this effort that are confirmed to
 * matter.
 */
export async function GET() {
  const cms = await getResolvedContent();

  const lines: string[] = [];
  lines.push(`# ${site.name}`);
  lines.push('');
  lines.push(site.description);
  lines.push('');

  lines.push('## Contact');
  lines.push(`Phone: ${site.contact.phone}`);
  lines.push(`Email: ${site.contact.email}`);
  lines.push(
    `Address: ${site.address.street}, ${site.address.suite}, ${site.address.city}, ${site.address.state} ${site.address.zip}`
  );
  lines.push(`Booking: ${site.url}${cms.booking.page}`);
  lines.push('');

  lines.push('## Where care is available');
  lines.push(`In-person office: ${site.address.city}, ${site.address.state}.`);
  if (cms.telehealthStates.length > 0) {
    lines.push(`Telehealth: ${cms.telehealthStates.map((s) => s.name).join(', ')}.`);
  }
  lines.push('');

  if (cms.homeServices.length > 0) {
    lines.push('## Services offered');
    for (const service of cms.homeServices) {
      lines.push(`- ${service.title}: ${service.description} (${site.url}${service.href})`);
    }
    lines.push('');
  }

  if (cms.fees.psychiatricStatePricing.length > 0) {
    lines.push('## Self-pay psychiatric pricing by state');
    for (const p of cms.fees.psychiatricStatePricing) {
      const scope = p.selfPayOnly ? 'self-pay only' : 'self-pay or insurance';
      const sliding = p.slidingScaleAvailable ? '; sliding scale available' : '';
      lines.push(
        `- ${p.state} (${scope}${sliding}): initial evaluation $${p.initialFee}, follow-up $${p.followUpFee}.`
      );
    }
    lines.push('');
  }

  if (cms.fees.otherSelfPayPricing.length > 0) {
    lines.push('## Other self-pay services');
    for (const tier of cms.fees.otherSelfPayPricing) {
      lines.push(
        `- ${tier.name}: initial $${tier.initialFee} (${tier.initialDuration}), follow-up $${tier.followUpFee} (${tier.followUpDuration}).`
      );
    }
    lines.push('');
  }

  if (cms.insurance.length > 0) {
    lines.push('## Accepted insurance (Florida only — Massachusetts and Arizona are self-pay only)');
    for (const carrier of cms.insurance) {
      lines.push(`- ${carrier.name}`);
    }
    lines.push('');
  }

  lines.push('## Key pages');
  const pages: Array<[string, string]> = [
    ['Homepage', '/'],
    ['Our Services', '/our-services'],
    ['Fees & Insurance', '/fees-insurance'],
    ['New Patients', '/new-patients'],
    ['Contact', '/contact-telehealth-mental-health-provider'],
    ['Book an Appointment', cms.booking.page],
    ['FAQs', '/faqs'],
    ['Meet Your Provider', '/bio'],
    ['For Providers', '/for-providers'],
    ['Partners', '/partners'],
  ];
  for (const [label, path] of pages) {
    lines.push(`- ${label}: ${site.url}${path}`);
  }
  for (const state of cms.telehealthStates) {
    lines.push(`- Telehealth in ${state.name}: ${site.url}/telehealth/${state.slug}`);
  }

  return new NextResponse(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
