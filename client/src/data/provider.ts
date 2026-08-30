import type { Provider } from '@/types/content';

/**
 * The practice's sole clinician. All content below is taken verbatim from the
 * source /bio/ page.
 *
 * Two source defects corrected:
 *  - The "Board certification" heading listed universities and the "Education"
 *    heading listed degrees without institutions — the two lists were swapped.
 *    They are paired correctly here.
 *  - A "Years of practice" heading was published with no value; the bio text
 *    states "over 15 years", which is used instead of leaving an empty field.
 */
export const provider: Provider = {
  name: 'Lourdie Chachoute',
  credentials: 'APRN, FNP-C, PMHNP-BC, RRT, CCRN',
  role: 'Psychiatric-Mental Health Nurse Practitioner',
  tagline:
    'Personalized, compassionate psychiatric care and professional PMHNP telehealth services designed to support your emotional wellness and long-term stability.',

  bio: [
    'I am a dual-certified Family Nurse Practitioner and Psychiatric-Mental Health Nurse Practitioner dedicated to providing compassionate, holistic, and evidence-based care. My philosophy is simple: mental health is health. I believe true wellness requires caring for the whole person — mind and body — in a safe, respectful, and judgment-free environment where you feel heard and supported.',
    "With over 15 years of diverse clinical experience in critical care, primary care, respiratory therapy, and mental health, I bring a well-rounded perspective to patient care. I specialize in diagnosing and treating anxiety, depression, ADHD, mood disorders, trauma-related conditions, and sleep disturbances. I also integrate women's health support, weight management, and chronic disease management into my practice, allowing me to address both emotional and physical health needs in a coordinated way.",
    "I earned my Bachelor of Science in Nursing from the University of Central Florida, my Master of Science in Nursing from South University, and a post-master's certificate from Walden University. I am currently pursuing my Doctor of Nursing Practice degree to further enhance the quality of care I provide.",
    'My approach combines comprehensive evaluation, thoughtful medication management, lifestyle guidance, and patient education. I work collaboratively with you to develop a personalized treatment plan focused on resilience, balance, and long-term well-being.',
  ],

  philosophy: 'Mental health is health.',

  education: [
    'Bachelor of Science in Nursing (BSN) — University of Central Florida',
    'Master of Science in Nursing (MSN) — South University',
    "Post-Master's Certificate, Psychiatric-Mental Health Nurse Practitioner — Walden University",
    'Currently pursuing Doctor of Nursing Practice (DNP)',
  ],

  certifications: [
    'Doctor of Nursing Practice (DNP) — University of Central Florida (in progress)',
    'FNP-C — Family Nurse Practitioner, Certified',
    'PMHNP-BC — Psychiatric-Mental Health Nurse Practitioner, Board Certified',
    'RRT — Registered Respiratory Therapist',
    'CCRN — Critical Care Registered Nurse',
  ],

  expertise: [
    'Anxiety disorders treatment',
    'Depression treatment',
    'ADHD evaluation and management',
    'Mood disorders (including bipolar disorder)',
    'Trauma and PTSD care',
    'Sleep disorder management',
    'Medication management',
    "Women's health support",
    'Weight management',
    'Chronic disease management',
    'PMHNP telehealth psychiatric care',
  ],

  approachIntro:
    'Mental health care should feel safe, supportive, and collaborative. I use an evidence-based approach while tailoring treatment to your individual needs.',

  approach: [
    'Personalized treatment planning',
    'Thoughtful medication management when appropriate',
    'Open and respectful communication',
    'A judgment-free, confidential environment',
    'Ongoing follow-up and support',
  ],

  approachOutcome:
    'My goal is not only symptom relief, but helping you regain confidence, clarity, and emotional balance.',

  image: {
    src: '/images/team/Lourdie-Chachoute.jpeg',
    width: 728,
    height: 900,
    alt: 'Lourdie Chachoute, FNP-C, PMHNP-BC — Psychiatric-Mental Health Nurse Practitioner',
  },
};

/** Years of experience, stated in the bio copy. */
export const yearsOfExperience = 15;

/** Secondary bio narrative used on the provider page. */
export const providerPage = {
  eyebrow: 'About Me',
  philosophyHeading: 'My Treatment Philosophy',
  philosophyImage: {
    src: '/images/sections/My-Treatment-Philosophy.avif',
    width: 1180,
    height: 1180,
    alt: 'A calm, private space for confidential telehealth mental health appointments',
  },
  consultation: {
    heading: 'Schedule Your Consultation Today',
    body: 'Take the first step toward better mental health with secure and personalized telehealth support tailored to your needs.',
    cta: { label: 'Book an Appointment', href: '/book-telehealth-mental-health-appointment#charm-calendar' },
  },
  /** As published in the /bio/ credential rows. */
  educationBlurb:
    "Bachelor of Science in Nursing (BSN), Master of Science in Nursing (MSN), Post-Master's Certificate (Psychiatric-Mental Health Nurse Practitioner), Currently pursuing Doctor of Nursing Practice (DNP)",
  boardBlurb: 'University of Central Florida, South University, Walden University',
  expertiseBlurb:
    "Anxiety disorders treatment, Depression treatment, ADHD evaluation and management, Mood disorders (including bipolar disorder), Trauma and PTSD care, Sleep disorder management, Medication management, Women's health support, Weight management, Chronic disease management, PMHNP telehealth psychiatric care",
  yearsBlurb: '15+',
  shifts: [
    { day: 'Monday', hours: '18:00-22:00' },
    { day: 'Tuesday', hours: '18:00-22:00' },
    { day: 'Wednesday', hours: '18:00-22:00' },
    { day: 'Thursday', hours: '18:00-22:00' },
    { day: 'Friday', hours: '07:00-22:00' },
    { day: 'Saturday', hours: '07:00-22:00' },
  ],
};
