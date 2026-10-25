export type ConditionFaq = { question: string; answer: string };

export type ConditionPage = {
  slug: string;
  name: string;
  title: string;
  metaDescription: string;
  summary: string;
  whatItIs: string;
  signs: string[];
  firstVisit: string;
  faqs: ConditionFaq[];
  sources: { label: string; href: string }[];
  serviceLinks: { label: string; href: string }[];
};

const NIMH = 'https://www.nimh.nih.gov/health';
const CDC = 'https://www.cdc.gov/adhd/about/index.html';
const APA = 'https://www.psychiatry.org/patients-families';

export const CONDITION_PAGES: ConditionPage[] = [
  {
    slug: 'adhd',
    name: 'ADHD',
    title: 'ADHD Psychiatric Treatment in Orlando & Telehealth',
    metaDescription:
      'Learn about ADHD evaluation and treatment for patients age 12+ in Orlando and by telehealth. Book a thoughtful, individualized visit with LifeWell.',
    summary:
      'ADHD is a condition that can affect attention, organization, activity level, and impulse control. LifeWell offers evaluation and ongoing psychiatric care for patients age 12 and older.',
    whatItIs:
      'Attention-deficit/hyperactivity disorder (ADHD) is a neurodevelopmental condition. People with ADHD may experience patterns of inattention, hyperactivity, or impulsivity that affect school, work, relationships, or daily routines. Similar experiences can also have other causes, so a full evaluation matters.',
    signs: [
      'Difficulty staying focused or finishing tasks',
      'Losing track of time, belongings, or responsibilities',
      'Restlessness or difficulty sitting still',
      'Interrupting, acting quickly, or having trouble waiting',
      'Challenges with planning, organization, or managing several steps',
    ],
    firstVisit:
      'At a first visit, the clinician asks about current concerns, health history, mood, sleep, school or work, relationships, and daily functioning. Evaluation may include screening questions and discussion of information from other settings when available. Medication options are discussed only after a full evaluation, and some medications have additional prescribing requirements.',
    faqs: [
      { question: 'Can ADHD be evaluated after age 12?', answer: 'Yes. LifeWell evaluates patients age 12 and older. The clinician reviews current symptoms and history rather than relying on one test.' },
      { question: 'Is there one test for ADHD?', answer: 'No. ADHD evaluation uses a clinical history, symptom discussion, and information about functioning across settings.' },
      { question: 'Can anxiety or sleep problems look like ADHD?', answer: 'Yes. Several health concerns can affect attention, so the clinician considers the full picture before discussing treatment.' },
      { question: 'Are medication options discussed?', answer: 'Medication options are discussed after a full evaluation, and some medications have additional prescribing requirements.' },
      { question: 'Can I have therapy and psychiatric care?', answer: 'Yes. With your permission, psychiatric care can be coordinated with your therapist or counselor.' },
    ],
    sources: [
      { label: 'CDC: About ADHD', href: CDC },
      { label: 'NIMH: Mental health information', href: `${NIMH}/index.shtml` },
      { label: 'American Psychiatric Association: Patients and families', href: APA },
    ],
    serviceLinks: [
      { label: 'Psychiatric evaluations', href: '/services/psychiatric-evaluations' },
      { label: 'Medication management', href: '/services/medication-management' },
      { label: 'ADHD and related treatment', href: '/services/treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd' },
    ],
  },
  {
    slug: 'anxiety',
    name: 'Anxiety',
    title: 'Anxiety Disorder Treatment in Orlando & Telehealth',
    metaDescription:
      'Explore anxiety evaluation and treatment for patients age 12+ in Orlando and by telehealth. LifeWell offers calm, individualized psychiatric support.',
    summary:
      'Anxiety can involve persistent worry, fear, or physical symptoms that make everyday life harder. Common forms include generalized anxiety, panic, social anxiety, and specific phobias. LifeWell provides evaluation and follow-up care for patients age 12 and older.',
    whatItIs:
      'Anxiety is a common human response to stress. An anxiety disorder involves symptoms that are difficult to control, last longer than expected, or interfere with daily life. Different anxiety conditions can look different, so an evaluation helps clarify what you are experiencing.',
    signs: [
      'Worry that feels difficult to control',
      'Feeling restless, tense, or on edge',
      'Trouble concentrating or sleeping',
      'Panic-like episodes or a racing heartbeat',
      'Avoiding places, activities, or situations because of fear',
    ],
    firstVisit:
      'The first visit focuses on your concerns, symptom patterns, health history, medications, sleep, stress, and daily functioning. The clinician also asks about safety and other conditions that can affect anxiety. Together, you can discuss appropriate next steps, which may include follow-up care and coordination with a therapist.',
    faqs: [
      { question: 'When should I seek an anxiety evaluation?', answer: 'Consider an evaluation when worry, fear, panic, or avoidance is persistent or interferes with work, school, relationships, sleep, or daily tasks.' },
      { question: 'Can anxiety cause physical symptoms?', answer: 'Yes. Anxiety may be associated with symptoms such as tension, a racing heart, stomach discomfort, or changes in sleep.' },
      { question: 'Can anxiety and depression occur together?', answer: 'Yes. Symptoms can overlap, so the clinician reviews mood, worry, sleep, energy, and functioning together.' },
      { question: 'Does telehealth work for anxiety care?', answer: 'Telehealth can provide evaluation and follow-up when you are located in Florida, Massachusetts, or Arizona.' },
      { question: 'Can LifeWell coordinate with my therapist?', answer: 'With your permission, the psychiatric clinician can coordinate care with your therapist or counselor.' },
    ],
    sources: [
      { label: 'NIMH: Anxiety disorders', href: `${NIMH}/anxiety-disorders/index.shtml` },
      { label: 'American Psychiatric Association: Anxiety disorders', href: 'https://www.psychiatry.org/patients-families/anxiety-disorders' },
      { label: 'NIMH: Mental health information', href: `${NIMH}/index.shtml` },
    ],
    serviceLinks: [
      { label: 'Psychiatric evaluations', href: '/services/psychiatric-evaluations' },
      { label: 'Medication management', href: '/services/medication-management' },
      { label: 'Anxiety and related treatment', href: '/services/treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd' },
    ],
  },
  {
    slug: 'depression',
    name: 'Depression',
    title: 'Depression Psychiatric Care in Orlando & Telehealth',
    metaDescription:
      'Learn about depression evaluation and treatment for patients age 12+ in Orlando and by telehealth. LifeWell provides personalized psychiatric follow-up care.',
    summary:
      'Depression can involve persistent sadness, loss of interest, low energy, sleep changes, and difficulty with daily functioning. LifeWell offers evaluation and psychiatric care for patients age 12 and older.',
    whatItIs:
      'Depression is more than a brief period of sadness. A depressive illness can affect emotions, thoughts, body, relationships, and the ability to manage everyday activities. A clinician looks at the duration, pattern, severity, and impact of symptoms.',
    signs: [
      'Persistent sadness, emptiness, or irritability',
      'Less interest or pleasure in usual activities',
      'Changes in sleep, appetite, or energy',
      'Difficulty concentrating or making decisions',
      'Feeling hopeless, guilty, or slowed down',
    ],
    firstVisit:
      'At the first visit, you can describe what has changed and how symptoms affect your routine. The clinician reviews health history, medications, sleep, stress, mood patterns, and safety. If appropriate, you can discuss medication options, follow-up timing, and coordination with a therapist or counselor.',
    faqs: [
      { question: 'How is depression evaluated?', answer: 'A clinician reviews symptoms, timing, health history, medications, sleep, functioning, and safety. There is no single blood test that diagnoses depression.' },
      { question: 'Can irritability be part of depression?', answer: 'Yes. Depression may involve irritability as well as sadness, low interest, fatigue, or changes in sleep and appetite.' },
      { question: 'How long do antidepressants take to work?', answer: 'Response varies. The clinician explains what to monitor and when follow-up is appropriate rather than promising a specific timeline.' },
      { question: 'Can depression care happen by telehealth?', answer: 'Yes. LifeWell provides psychiatric telehealth for patients located in Florida, Massachusetts, or Arizona.' },
      { question: 'What if I am having thoughts of self-harm?', answer: 'Call or text 988 for immediate crisis support, or call 911. LifeWell is outpatient care and does not provide emergency services.' },
    ],
    sources: [
      { label: 'NIMH: Depression', href: `${NIMH}/depression/index.shtml` },
      { label: 'American Psychiatric Association: Depression', href: 'https://www.psychiatry.org/patients-families/depression' },
      { label: '988 Suicide & Crisis Lifeline', href: 'https://988lifeline.org/' },
    ],
    serviceLinks: [
      { label: 'Psychiatric evaluations', href: '/services/psychiatric-evaluations' },
      { label: 'Medication management', href: '/services/medication-management' },
      { label: 'Depression and related treatment', href: '/services/treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd' },
    ],
  },
  {
    slug: 'bipolar-disorder',
    name: 'Bipolar Disorder',
    title: 'Bipolar Disorder Treatment in Orlando & Telehealth',
    metaDescription:
      'Learn about bipolar disorder evaluation and ongoing care for patients age 12+ in Orlando and by telehealth, with individualized psychiatric follow-up.',
    summary:
      'Bipolar disorder involves shifts in mood, energy, activity, and concentration, including elevated or irritable periods and depressive periods. LifeWell provides evaluation and outpatient follow-up for patients age 12 and older.',
    whatItIs:
      'Bipolar disorder involves episodes of unusually elevated or irritable mood and episodes of depression. Mood changes can affect sleep, energy, judgment, concentration, and daily life. Care begins with a careful history because several conditions can cause overlapping symptoms.',
    signs: [
      'Periods of unusually high energy or reduced need for sleep',
      'Feeling unusually driven, restless, or irritable',
      'Racing thoughts or talking much faster than usual',
      'Impulsive decisions or changes in judgment',
      'Periods of low mood, low energy, or loss of interest',
    ],
    firstVisit:
      'The first visit includes a detailed discussion of mood episodes, sleep, energy, medications, health history, family history, and daily functioning. The clinician may ask about changes noticed by trusted people. Follow-up care focuses on monitoring patterns, discussing appropriate options, and coordinating with other members of your care team when you give permission.',
    faqs: [
      { question: 'How is bipolar disorder evaluated?', answer: 'Evaluation includes a detailed history of mood, sleep, energy, behavior, medications, and functioning over time. The clinician also considers other possible causes.' },
      { question: 'Can bipolar disorder include depression?', answer: 'Yes. Bipolar disorder can include depressive episodes as well as episodes of elevated or irritable mood and increased energy.' },
      { question: 'Why is sleep important to discuss?', answer: 'Changes in sleep can be part of mood episodes and can also affect mood, so sleep patterns are an important part of evaluation and follow-up.' },
      { question: 'Does LifeWell provide emergency care?', answer: 'No. LifeWell provides outpatient care. If you are in crisis, call or text 988, or call 911.' },
      { question: 'Can care be coordinated with a therapist?', answer: 'With your permission, the psychiatric clinician can coordinate with your therapist or counselor.' },
    ],
    sources: [
      { label: 'NIMH: Bipolar disorder', href: `${NIMH}/bipolar-disorder/index.shtml` },
      { label: 'American Psychiatric Association: Bipolar disorder', href: 'https://www.psychiatry.org/patients-families/bipolar-disorders' },
      { label: '988 Suicide & Crisis Lifeline', href: 'https://988lifeline.org/' },
    ],
    serviceLinks: [
      { label: 'Psychiatric evaluations', href: '/services/psychiatric-evaluations' },
      { label: 'Medication management', href: '/services/medication-management' },
      { label: 'Combined condition treatment', href: '/services/treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd' },
    ],
  },
  {
    slug: 'ptsd',
    name: 'PTSD',
    title: 'PTSD Psychiatric Treatment in Orlando & Telehealth',
    metaDescription:
      'Learn about PTSD evaluation and outpatient treatment for patients age 12+ in Orlando and by telehealth, with compassionate psychiatric follow-up from LifeWell.',
    summary:
      'Post-traumatic stress disorder (PTSD) can develop after a traumatic experience and affect memories, mood, sleep, and daily life, including unwanted memories and feeling constantly on guard. LifeWell offers outpatient evaluation and care.',
    whatItIs:
      'PTSD can develop after someone experiences or witnesses a traumatic event. Symptoms may include unwanted memories, avoidance, changes in mood or thinking, and feeling constantly on guard. Not everyone who experiences trauma develops PTSD, and support can help clarify what is happening.',
    signs: [
      'Unwanted memories, dreams, or reminders of the event',
      'Avoiding people, places, or conversations connected to it',
      'Feeling watchful, tense, easily startled, or irritable',
      'Changes in mood, trust, or connection with others',
      'Sleep or concentration problems',
    ],
    firstVisit:
      'You control how much detail you share. The first visit focuses on current symptoms, safety, sleep, mood, health history, medications, and how daily life is affected. The clinician can discuss outpatient psychiatric options and coordinate with a trauma-informed therapist or counselor with your permission.',
    faqs: [
      { question: 'Does everyone who experiences trauma develop PTSD?', answer: 'No. Responses to trauma vary. An evaluation looks at symptoms, duration, distress, and effects on daily functioning.' },
      { question: 'Do I have to describe every detail of the trauma?', answer: 'No. You can share what feels safe and useful. The clinician can begin with current symptoms and needs.' },
      { question: 'Can PTSD affect sleep?', answer: 'Yes. PTSD may involve nightmares, difficulty falling asleep, waking often, or feeling on guard.' },
      { question: 'Can PTSD care happen by telehealth?', answer: 'Yes. LifeWell provides outpatient psychiatric telehealth for patients located in Florida, Massachusetts, or Arizona.' },
      { question: 'What should I do in a crisis?', answer: 'If you are in crisis, call or text 988, or call 911. LifeWell does not provide emergency services.' },
    ],
    sources: [
      { label: 'NIMH: PTSD', href: `${NIMH}/post-traumatic-stress-disorder-ptsd/index.shtml` },
      { label: 'American Psychiatric Association: PTSD', href: 'https://www.psychiatry.org/patients-families/ptsd' },
      { label: '988 Suicide & Crisis Lifeline', href: 'https://988lifeline.org/' },
    ],
    serviceLinks: [
      { label: 'Psychiatric evaluations', href: '/services/psychiatric-evaluations' },
      { label: 'Medication management', href: '/services/medication-management' },
      { label: 'Combined condition treatment', href: '/services/treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd' },
    ],
  },
];

export const getConditionPage = (slug: string) => CONDITION_PAGES.find((page) => page.slug === slug);
