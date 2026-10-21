export interface PsychiatricCondition {
  id: string;
  name: string;
  prevalence: string;
  description: string;
  citations: string[];
  canonicalPath: string;
}

export const PSYCHIATRIC_CONDITIONS: PsychiatricCondition[] = [
  {
    id: 'anxiety-disorders',
    name: 'Anxiety Disorders',
    prevalence: '19.1% of U.S. adults annually',
    description:
      'Includes generalized anxiety disorder (GAD), panic disorder, social anxiety disorder, and specific phobias.',
    citations: ['1', '2'],
    canonicalPath: '/our-services/anxiety-disorders',
  },
  {
    id: 'major-depressive-disorder',
    name: 'Major Depressive Disorder (MDD)',
    prevalence: '15.5% of U.S. adults',
    description:
      'Involves persistent feelings of sadness, loss of interest, and low energy that interfere with daily life.',
    citations: ['1'],
    canonicalPath: '/our-services/depression-mdd',
  },
  {
    id: 'ptsd',
    name: 'Post-Traumatic Stress Disorder (PTSD)',
    prevalence: '4.1% of U.S. adults',
    description:
      'Develops after experiencing or witnessing a traumatic event, leading to flashbacks, hypervigilance, and severe anxiety.',
    citations: ['1', '2'],
    canonicalPath: '/our-services/ptsd',
  },
  {
    id: 'bipolar-disorder',
    name: 'Bipolar Disorder',
    prevalence: '2.8% of individuals',
    description:
      'Causes extreme shifts in mood, energy, and activity levels, ranging from manic highs to depressive lows.',
    citations: ['1', '2'],
    canonicalPath: '/our-services/bipolar-disorder',
  },
  {
    id: 'adhd',
    name: 'Attention-Deficit/Hyperactivity Disorder (ADHD)',
    prevalence: 'Affects both children and adults',
    description:
      'Marked by ongoing patterns of inattention, hyperactivity, and impulsivity.',
    citations: ['1'],
    canonicalPath: '/our-services/adhd',
  },
  {
    id: 'ocd',
    name: 'Obsessive-Compulsive Disorder (OCD)',
    prevalence: 'Variable adult prevalence',
    description:
      'Involves unwanted, repetitive intrusive thoughts (obsessions) and driven repetitive behaviors or mental acts (compulsions).',
    citations: ['1'],
    canonicalPath: '/our-services/ocd',
  },
  {
    id: 'borderline-personality-disorder',
    name: 'Borderline Personality Disorder (BPD)',
    prevalence: '1.4% of U.S. adults',
    description:
      'Characterized by unstable moods, self-image, and interpersonal relationships.',
    citations: ['1'],
    canonicalPath: '/our-services/borderline-personality-disorder',
  },
  {
    id: 'eating-disorders',
    name: 'Eating Disorders',
    prevalence: 'Severe behavioral impact',
    description:
      'Conditions like anorexia nervosa, bulimia nervosa, and binge-eating disorder involve severe disturbances in eating behavior and body image.',
    citations: ['1'],
    canonicalPath: '/our-services/eating-disorders',
  },
  {
    id: 'schizophrenia-spectrum',
    name: 'Schizophrenia Spectrum Disorders',
    prevalence: '1.2% of people',
    description:
      'Conditions that can include hallucinations, delusions, and disorganized thinking.',
    citations: ['1', '2', '3'],
    canonicalPath: '/our-services/schizophrenia-spectrum',
  },
];

export const getPsychiatricCondition = (id: string) =>
  PSYCHIATRIC_CONDITIONS.find((condition) => condition.id === id);
