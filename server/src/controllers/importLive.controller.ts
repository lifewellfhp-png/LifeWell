import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import { writeAuditLog } from '../lib/audit.js';
import { refreshPublicSite } from '../lib/refreshSite.js';
import { DEFAULT_SITE_SETTINGS } from '../validation/adminSchemas.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';

const SERVICES = [
  ['psychiatric-evaluations', 'Psychiatric Evaluations', 'I provide thorough psychiatric evaluations through secure telehealth services to assess your symptoms, understand your mental health history, and develop a personalized treatment plan that supports your long-term emotional and psychological well-being.'],
  ['medication-management', 'Medication Management', 'I provide ongoing psychiatric medication management through secure telehealth services to ensure your treatment is safe, effective, and tailored to your individual mental health needs.'],
  ['treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd', 'Treatment for Depression, Anxiety, ADHD, Bipolar Disorder & PTSD', 'I provide personalized, evidence-based treatment through secure telehealth services to help you manage symptoms, restore emotional balance, and achieve long-term mental wellness.'],
  ['psychiatric-follow-up-visits-telehealth', 'Follow-Up Visits for Ongoing Mental Health Care', 'Mental health treatment is an ongoing process that requires consistent monitoring, communication, and adjustments over time — delivered through secure telehealth follow-up visits.'],
  ['annual-physical-exam-telehealth', 'Annual Physicals & Preventive Screenings', 'I provide annual physical exams and preventive screenings through secure telehealth visits to help you stay ahead of health risks and maintain your long-term wellbeing.'],
  ['chronic-disease-management-telehealth', 'Chronic Disease Management', 'I provide ongoing chronic disease management through secure telehealth visits for conditions such as hypertension, diabetes, hyperlipidemia, and thyroid disorders.'],
  ['preventive-care-telehealth', 'Preventive Care', 'I provide comprehensive preventive care through secure telehealth visits to help identify health risks early, support healthy lifestyle habits, and protect your long-term physical and mental well-being.'],
  ['telehealth-sick-visits-primary-care', 'Sick Visits (Acute Primary Care – Adults 18+)', 'I provide telehealth sick visits for adults to evaluate and treat common acute medical concerns such as cold symptoms, sinus infections, UTIs, allergies, and minor health issues—helping you receive timely care without leaving your home.'],
  ['weight-management-telehealth', 'Weight Management', 'I provide comprehensive weight management through secure telehealth visits, including metabolic evaluation, personalized treatment plans, and medication-assisted weight loss when appropriate to support your long-term health.'],
  ['wellness-and-lifestyle-counseling-telehealth', 'Wellness and Lifestyle Counseling', 'I provide personalized wellness and lifestyle counseling through secure telehealth visits to help you improve nutrition, sleep, stress management, and daily habits that support long-term physical and mental health.'],
  ['lab-testing-coordination-telehealth', 'Lab Testing Coordination', 'I provide lab testing coordination through secure telehealth visits, including ordering appropriate laboratory tests, reviewing results, and explaining findings to help guide your treatment and protect your long-term health.'],
] as const;

const SERVICE_META: Record<string, { image: string; category: 'psychiatric' | 'primary-care' }> = {
  'psychiatric-evaluations': { image: '/images/services/Psychiatric-Evaluation-Telehealth.avif', category: 'psychiatric' },
  'medication-management': { image: '/images/services/Psychiatric-Medication-Management-Telehealth.avif', category: 'psychiatric' },
  'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd': { image: '/images/services/Telehealth-Treatment-for-Depression-Anxiety-ADHD-PTSD.avif', category: 'psychiatric' },
  'psychiatric-follow-up-visits-telehealth': { image: '/images/services/Psychiatric-Follow-Up-Visits-Telehealth.avif', category: 'psychiatric' },
  'annual-physical-exam-telehealth': { image: '/images/services/Annual-Physical-Exam-Telehealth.avif', category: 'primary-care' },
  'chronic-disease-management-telehealth': { image: '/images/services/Chronic-Disease-Management-Telehealth.avif', category: 'primary-care' },
  'preventive-care-telehealth': { image: '/images/services/Preventive-Care-Telehealth.avif', category: 'primary-care' },
  'telehealth-sick-visits-primary-care': { image: '/images/services/Telehealth-Sick-Visits-Primary-Care.avif', category: 'primary-care' },
  'weight-management-telehealth': { image: '/images/services/Weight-Management-Telehealth.avif', category: 'primary-care' },
  'wellness-and-lifestyle-counseling-telehealth': { image: '/images/services/Wellness-and-Lifestyle-Counseling-Telehealth.avif', category: 'primary-care' },
  'lab-testing-coordination-telehealth': { image: '/images/services/Lab-Testing-Coordination-Telehealth.avif', category: 'primary-care' },
};

const FAQS = [
  ['What is telehealth mental health care?', 'Telehealth mental health care allows you to receive therapy, psychiatric evaluation, and medication management through secure video appointments instead of in-person visits.'],
  ['How do I schedule an appointment?', 'You can schedule an appointment using the online booking system. After scheduling, you will receive confirmation and instructions for your telehealth session.'],
  ['Do you accept insurance?', 'We accept select insurance plans. Please contact us or visit the Fees & Insurance page to verify coverage and payment options.'],
  ['Are telehealth sessions confidential?', 'Yes. All telehealth sessions are conducted through our telehealth platform, which is designed with your privacy and confidentiality in mind.'],
  ['What do I need for a telehealth appointment?', 'You will need a stable internet connection, a computer, tablet, or smartphone, and a private location for your session.'],
  ['Can I reschedule or cancel my appointment?', 'Yes. Appointments can be rescheduled or canceled according to the cancellation policy. Please contact us in advance to make changes.'],
  ['What insurance plans do you accept?', 'I accept select insurance plans for mental health services. Coverage may vary depending on your insurance provider and individual policy. Please contact me directly to confirm whether your plan is accepted and to verify your mental health benefits.'],
  ['Do you offer self-pay options?', 'Yes, I offer self-pay options for individuals who prefer not to use insurance or whose plans are out-of-network. Transparent fees will be discussed before your appointment so you can make an informed and confident decision about your care.'],
  ['How much does a telehealth therapy session cost?', 'My session fees vary depending on the type of service provided, such as individual therapy, couples therapy, or medication management. I provide detailed fee and insurance information during the scheduling process to ensure full transparency and help you make an informed decision.'],
  ['Do you provide superbills for out-of-network reimbursement?', 'Yes, upon request, I can provide a superbill for patients seeking out-of-network reimbursement from their insurance provider. Reimbursement eligibility depends on your individual insurance policy.'],
] as const;

const FAQ_CATEGORIES = [
  'General',
  'General',
  'General',
  'General',
  'General',
  'General',
  'Fees',
  'Fees',
  'Fees',
  'Fees',
] as const;

/**
 * Only testimonials with real, substantiated content are seeded. Three
 * additional placeholder reviews (attributed to "Elisa Smith", "Sofia
 * Taylor", "Marco Davies") described the practice as providing direct
 * psychotherapy, which the current service lineup does not represent, and
 * are intentionally not seeded — see client/src/data/marketing.ts.
 */
const REVIEWS = [
  ['Mary Mayers', 'Extremely present and responsive team of providers. You can feel they are here to help you improve your quality of life, whether that is working to find a medication with them or continuing therapy and alternative life changes outside of this practice.'],
] as const;

async function missingThenInsert(
  table: string,
  existingKey: string,
  existingValues: string[],
  rows: Record<string, unknown>[]
): Promise<number> {
  const sb = getSupabase();
  const toInsert = rows.filter((row) => !existingValues.includes(String(row[existingKey] || '')));
  if (!toInsert.length) return 0;
  const { error } = await sb.from(table).insert(toInsert);
  if (error) throw badRequest(`${table}: ${error.message}`);
  return toInsert.length;
}

/**
 * Seeds default website content. STRICTLY NON-DESTRUCTIVE: every table only
 * receives rows that do not exist yet. Rows the admin has edited, unpublished,
 * or customized are never touched — re-running this can never lose admin work.
 */
export async function runLiveImport(): Promise<Record<string, number>> {
  const sb = getSupabase();
  const counts: Record<string, number> = {};

  const { data: serviceRows, error: serviceReadErr } = await sb.from('services').select('slug');
  if (serviceReadErr) throw badRequest(serviceReadErr.message);
  const haveServiceSlugs = new Set((serviceRows || []).map((r) => String(r.slug)));
  const missingServices = SERVICES.filter(([slug]) => !haveServiceSlugs.has(slug));
  if (missingServices.length) {
    const servicePayload = missingServices.map(([slug, title, summary], i) => ({
      slug,
      title,
      summary,
      image_url: SERVICE_META[slug]?.image || null,
      icon: SERVICE_META[slug]?.image || null,
      category: SERVICE_META[slug]?.category || 'psychiatric',
      published: true,
      sort_order: i,
    }));
    let { error: serviceInsertErr } = await sb.from('services').insert(servicePayload);
    if (serviceInsertErr && /does not exist|schema cache/i.test(serviceInsertErr.message)) {
      const fallback = missingServices.map(([slug, title, summary], i) => ({
        slug,
        title,
        summary,
        icon: SERVICE_META[slug]?.image || null,
        published: true,
        sort_order: i,
      }));
      const retry = await sb.from('services').insert(fallback);
      serviceInsertErr = retry.error;
    }
    if (serviceInsertErr) throw badRequest(serviceInsertErr.message);
  }
  counts.services = missingServices.length;

  const { data: faqRows, error: faqErr } = await sb.from('faqs').select('question');
  if (faqErr) throw badRequest(faqErr.message);
  counts.faqs = await missingThenInsert(
    'faqs',
    'question',
    (faqRows || []).map((r) => String(r.question)),
    FAQS.map(([question, answer], i) => ({
      question,
      answer,
      category: FAQ_CATEGORIES[i] || 'General',
      published: true,
      sort_order: i,
    }))
  );

  // Insurance is intentionally NOT seeded here. Plans are fully Admin-managed
  // CMS data (Admin → Insurance) and this import must have zero write
  // authority over insurance_plans — a stale hardcoded seed list previously
  // reintroduced obsolete payer records once the CMS names diverged from it.

  const { data: reviewRows, error: reviewErr } = await sb.from('testimonials').select('author_name');
  if (reviewErr) throw badRequest(reviewErr.message);
  counts.reviews = await missingThenInsert(
    'testimonials',
    'author_name',
    (reviewRows || []).map((r) => String(r.author_name)),
    REVIEWS.map(([author_name, quote], i) => ({
      author_name,
      quote,
      rating: 5,
      published: true,
      consent_confirmed: true,
      sort_order: i,
    }))
  );

  const homeSections = [
    {
      page_key: 'home',
      section_key: 'hero',
      title: 'Homepage hero',
      published: true,
      content: {
        badge: 'Now Accepting New Patients | Telehealth & Orlando Appointments',
        headline: 'Personalized Mental Health Care for Mind and Body',
        subhead:
          'Compassionate, evidence-based psychiatric care with a whole-person approach — available through secure telehealth and in-person visits in Orlando.',
      },
    },
    {
      page_key: 'home',
      section_key: 'welcome',
      title: 'Welcome',
      published: true,
      content: {
        heading: 'Welcome to LifeWell Family Health & Psychiatry',
        body: [
          'At LifeWell Family Health & Psychiatry, care is centered on the whole person — mind and body. We provide personalized, evidence-based psychiatric care with the flexibility of secure telehealth and in-person visits in Orlando.',
          'Services include psychiatric evaluations, medication management, and support for anxiety, depression, ADHD, trauma-related symptoms, sleep concerns, and other mental health needs. Every care plan is designed to help you feel heard, supported, and confident in your next steps.',
        ],
      },
    },
    {
      page_key: 'home',
      section_key: 'services',
      title: 'Services intro',
      published: true,
      content: {
        eyebrow: 'My Services',
        heading: 'How I Help',
        body: 'Specialized telehealth services tailored to meet your unique mental health needs.',
        cta: 'View All Services',
      },
    },
    {
      page_key: 'home',
      section_key: 'benefits',
      title: 'Why patients choose us',
      published: true,
      content: {
        heading: 'Why Patients Choose My Telehealth Clinic',
        items: [
          {
            title: 'Personalized One-on-One Care',
            description:
              'Every patient receives individual attention and a treatment plan tailored to their unique needs, goals, and mental health journey.',
            image: '/images/benefits/Personalized-One-on-One-Care.avif',
          },
          {
            title: 'Private & Secure Telehealth Sessions',
            description:
              'All appointments are conducted through our telehealth platform, designed with your privacy and confidentiality in mind at every step.',
            image: '/images/benefits/Private-Secure-Telehealth-Sessions.avif',
          },
          {
            title: 'Flexible & Convenient Scheduling',
            description:
              'Book appointments that fit your lifestyle with easy online scheduling and virtual access from the comfort of your home.',
            image: '/images/benefits/Flexible-Convenient-Scheduling.avif',
          },
          {
            title: 'Compassionate, Judgment-Free Support',
            description:
              'I provide a safe and supportive environment where you can openly discuss your concerns without fear of stigma or judgment.',
            image: '/images/benefits/Compassionate-Judgment-Free-Support.avif',
          },
          {
            title: 'Evidence-Based Treatment Approach',
            description:
              'My care is guided by my clinical experience and evidence-based treatment methods, allowing me to provide effective, compassionate, and personalized mental health support.',
            image: '/images/benefits/Evidence-Based-Treatment-Approach.avif',
          },
        ],
      },
    },
    {
      page_key: 'home',
      section_key: 'how_it_works',
      title: 'How it works',
      published: true,
      content: {
        eyebrow: 'How It Works',
        heading: 'How My Simple Telehealth Process Works',
        body: 'Getting started is simple. Follow these three easy steps to begin your mental wellness journey.',
        steps: [
          {
            title: 'Book Your Appointment',
            description:
              'Schedule your appointment online through my secure booking system and choose a date and time that works best for you.',
          },
          {
            title: 'Attend Your Virtual Session',
            description:
              'You will meet with me through a secure telehealth platform, allowing you to receive care from the comfort and privacy of your home.',
          },
          {
            title: 'Begin Your Personalized Care Plan',
            description:
              'Receive a tailored treatment plan, medication management (if needed), and ongoing support to help you move forward with confidence.',
          },
        ],
      },
    },
    {
      page_key: 'home',
      section_key: 'stats',
      title: 'Stats band',
      published: true,
      content: {
        items: [
          { value: 1, suffix: '', label: 'Licensed Provider' },
          { value: 15, suffix: '+', label: 'Years of Experience' },
          { value: 24, suffix: '/7', label: 'Secure Online Access' },
        ],
      },
    },
  ];

  const { data: sectionRows, error: sectionReadErr } = await sb
    .from('site_sections')
    .select('page_key,section_key');
  if (sectionReadErr) throw badRequest(sectionReadErr.message);
  const haveSections = new Set((sectionRows || []).map((r) => `${r.page_key}:${r.section_key}`));
  const missingSections = homeSections.filter((s) => !haveSections.has(`${s.page_key}:${s.section_key}`));
  if (missingSections.length) {
    const { error: sectionErr } = await sb.from('site_sections').insert(missingSections);
    if (sectionErr) throw badRequest(sectionErr.message);
  }
  counts.sections = missingSections.length;

  const { data: existingProvider } = await sb
    .from('providers')
    .select('id')
    .eq('slug', 'lourdie-chachoute')
    .maybeSingle();
  const providerErr = existingProvider
    ? null
    : (
        await sb.from('providers').insert({
      slug: 'lourdie-chachoute',
      name: 'Lourdie Chachoute',
      credentials: 'FNP-C, PMHNP-BC, RRT, CCRN',
      title: 'Psychiatric-Mental Health Nurse Practitioner',
      bio: [
        'I am a dual-certified Family Nurse Practitioner and Psychiatric-Mental Health Nurse Practitioner dedicated to providing compassionate, holistic, and evidence-based care. My philosophy is simple: mental health is health. I believe true wellness requires caring for the whole person — mind and body — in a safe, respectful, and judgment-free environment where you feel heard and supported.',
        'With over 15 years of diverse clinical experience in critical care, primary care, respiratory therapy, and mental health, I bring a well-rounded perspective to patient care. I specialize in diagnosing and treating anxiety, depression, ADHD, mood disorders, trauma-related conditions, and sleep disturbances. I also integrate women’s health support, weight management, and chronic disease management into my practice, allowing me to address both emotional and physical health needs in a coordinated way.',
        'I earned my Bachelor of Science in Nursing from the University of Central Florida, my Master of Science in Nursing from South University, and a post-master’s certificate from Walden University. I am currently pursuing my Doctor of Nursing Practice degree to further enhance the quality of care I provide.',
        'My approach combines comprehensive evaluation, thoughtful medication management, lifestyle guidance, and patient education. I work collaboratively with you to develop a personalized treatment plan focused on resilience, balance, and long-term well-being.',
      ].join('\n\n'),
      education: [
        'Bachelor of Science in Nursing (BSN) — University of Central Florida',
        'Master of Science in Nursing (MSN) — South University',
        'Post-Master’s Certificate, Psychiatric-Mental Health Nurse Practitioner — Walden University',
        'Currently pursuing Doctor of Nursing Practice (DNP)',
      ],
      certifications: [
        'FNP-C — Family Nurse Practitioner, Certified',
        'PMHNP-BC — Psychiatric-Mental Health Nurse Practitioner, Board Certified',
        'RRT — Registered Respiratory Therapist',
        'CCRN — Critical Care Registered Nurse',
      ],
      photo_url: '/images/team/Lourdie-Chachoute.jpeg',
      published: true,
      sort_order: 0,
        })
      ).error;
  if (providerErr) throw badRequest(providerErr.message);
  counts.providers = existingProvider ? 0 : 1;

  const { data: locations } = await sb.from('locations').select('name');
  const hasLocation = (locations || []).some((r) => r.name === 'LifeWell Family Health & Psychiatry');
  if (!hasLocation) {
    const { error } = await sb.from('locations').insert({
      name: 'LifeWell Family Health & Psychiatry',
      address_line1: '3680 Avalon Park E Blvd',
      address_line2: 'Suite 310',
      city: 'Orlando',
      state: 'FL',
      postal_code: '32828',
      phone: '(407) 603-1717',
      email: 'contact@lifewellfhp.com',
      hours: { weekday: 'Monday – Friday 8:00 AM – 10:00 PM EST', weekend: 'Saturday – Sunday 7:00 AM – 10:00 PM EST' },
      is_primary: true,
      published: true,
    });
    if (error) throw badRequest(error.message);
    counts.locations = 1;
  } else {
    counts.locations = 0;
  }

  const { data: booking } = await sb.from('booking_settings').select('id').limit(1);
  if (!booking?.length) {
    const { error } = await sb.from('booking_settings').insert({
      label: 'Book an Appointment',
      booking_url:
        'https://ehr.charmtracker.com/publicCal.sas?method=getCal&digest=26a1a06adbd537c481b1d04dd4f7172a298949fe2840a1731b54d620355c17e76ee57013c1a537e61871e728dd80f5a6c2fe0580a6189219',
      provider: 'charmhealth',
      active: true,
    });
    if (error) throw badRequest(error.message);
    counts.booking = 1;
  } else {
    counts.booking = 0;
  }

  const { data: existingLogo } = await sb
    .from('media_assets')
    .select('id')
    .eq('url', '/images/brand/logo-v2.avif')
    .maybeSingle();
  if (!existingLogo) {
    const { error } = await sb.from('media_assets').insert({
      title: 'LifeWell logo',
      url: '/images/brand/logo-v2.avif',
      alt_text: 'LifeWell Family Health & Psychiatry',
      mime_type: 'image/avif',
      folder: 'brand',
    });
    if (error) throw badRequest(error.message);
    counts.media = 1;
  } else {
    counts.media = 0;
  }

  const { data: existingSettings } = await sb.from('site_settings').select('id').eq('id', 'default').maybeSingle();
  if (!existingSettings) {
    await sb.from('site_settings').upsert({
      ...DEFAULT_SITE_SETTINGS,
      logo_url: '/images/brand/logo-v2.avif',
      practice_phone: '(407) 603-1717',
      practice_email: 'contact@lifewellfhp.com',
      updated_at: new Date().toISOString(),
    });
    counts.settings = 1;
  } else {
    counts.settings = 0;
  }

  const seoRows = [
    {
      path: '/',
      title: 'Telehealth Mental Health Care | PMHNP Online Therapy & Medication Management',
      description:
        'Compassionate telehealth mental health care by a board-certified PMHNP. Personalized online therapy, medication management, and secure virtual appointments.',
    },
    {
      path: '/faqs',
      title: 'Frequently Asked Questions — Telehealth Mental Health Care',
      description:
        'Answers to common questions about telehealth mental health care — how appointments work, insurance and fees, confidentiality, what you need for a visit, and rescheduling.',
    },
    {
      path: '/bio',
      title: 'Meet Your Provider — Lourdie Chachoute, PMHNP-BC',
      description:
        'Meet Lourdie Chachoute, FNP-C, PMHNP-BC — a dual-certified Family and Psychiatric-Mental Health Nurse Practitioner with over 15 years of clinical experience, providing telehealth psychiatric care.',
    },
    {
      path: '/fees-insurance',
      title: 'Fees & Insurance — Transparent Telehealth Pricing',
      description:
        'Transparent telehealth fees and insurance information — self-pay rates for mental health, primary care and weight management, plus accepted plans and superbill details.',
    },
    {
      path: '/our-services',
      title: 'Telehealth Services | Psychiatric Care and Family Health',
      description: 'Psychiatric evaluations, medication management, and family health services through secure telehealth.',
    },
  ];
  const { data: seoExisting, error: seoReadErr } = await sb.from('seo_meta').select('path');
  if (seoReadErr) throw badRequest(seoReadErr.message);
  const haveSeoPaths = new Set((seoExisting || []).map((r) => String(r.path)));
  const missingSeo = seoRows.filter((row) => !haveSeoPaths.has(row.path));
  if (missingSeo.length) {
    const { error: seoErr } = await sb.from('seo_meta').insert(missingSeo);
    if (seoErr) throw badRequest(seoErr.message);
  }
  counts.seo = missingSeo.length;

  return counts;
}

export async function importLiveWebsiteContent(req: Request, res: Response): Promise<void> {
  const counts = await runLiveImport();
  const inserted = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'create',
    resource: 'settings',
    summary: inserted
      ? `Restored ${inserted} missing default content item(s) — existing content untouched`
      : 'Checked default content — everything already present, nothing changed',
  });
  if (inserted) void refreshPublicSite();

  res.json({
    success: true,
    message: inserted
      ? `Added ${inserted} missing default item(s). Your existing edits were not changed.`
      : 'All default content is already in the admin panel. Nothing was changed.',
    data: counts,
  });
}
