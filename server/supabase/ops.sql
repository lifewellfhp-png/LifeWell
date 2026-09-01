-- LifeWell admin ops: notifications, audit trail, email log, site appearance.
-- Run this in the Supabase SQL editor if tables are missing.

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_name text,
  action text not null,
  resource text not null,
  resource_id text,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx on admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_idx on admin_audit_logs (actor_email);

alter table admin_audit_logs enable row level security;

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('lead', 'email', 'staff_action')),
  audience text not null default 'all' check (audience in ('all', 'super_admin')),
  title text not null,
  body text,
  href text,
  read_by jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_created_idx on admin_notifications (created_at desc);

create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  from_email text,
  from_name text,
  to_email text not null,
  to_name text,
  subject text not null,
  body text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  lead_id uuid,
  sent_by uuid,
  sent_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists email_messages_created_idx on email_messages (created_at desc);
create index if not exists email_messages_status_idx on email_messages (status);

create table if not exists site_settings (
  id text primary key default 'default',
  primary_color text not null default '#3E7FB1',
  accent_color text not null default '#5FAF6B',
  heading_font text not null default 'Lora',
  body_font text not null default 'Source Sans 3',
  header_cta_label text not null default 'Book an Appointment',
  header_cta_url text not null default '/book-telehealth-mental-health-appointment',
  logo_url text,
  practice_phone text,
  practice_email text,
  inbox_email text,
  updated_at timestamptz not null default now()
);

insert into site_settings (id)
values ('default')
on conflict (id) do nothing;

alter table email_messages add column if not exists direction text default 'outbound';
alter table email_messages add column if not exists from_email text;
alter table email_messages add column if not exists from_name text;
alter table site_settings add column if not exists inbox_email text;

alter table admin_notifications enable row level security;
alter table email_messages enable row level security;
alter table site_settings enable row level security;

alter table services add column if not exists image_url text;
alter table services add column if not exists category text;

-- Self-service password change (Admin "Your Account" panel): lets
-- requireAdmin reject every JWT issued before a password change, not just
-- ones that happen to expire. Bumped on every password change; embedded in
-- the JWT as `tv` at sign time and compared against this column on every
-- authenticated admin request.
alter table admin_users add column if not exists token_version integer not null default 0;

-- P2B: Wellness Resource Hub taxonomy + article-to-service linking.
alter table blog_posts add column if not exists category text;
alter table blog_posts add column if not exists related_service_slug text;

-- Telehealth state pages: CMS management for /telehealth/florida, /massachusetts, /arizona.
-- This is a NEW table (not an alter of an existing one) — it must exist before the
-- server/client code that queries it is deployed, or the public content API will
-- fail the same way it did when blog_posts.category was queried before its column existed.
create table if not exists telehealth_state_pages (
  id uuid primary key default gen_random_uuid(),
  state_name text not null,
  state_code text not null unique,
  slug text not null unique,
  published boolean not null default true,
  badge text,
  heading text,
  subheading text,
  body text,
  care_mode text,
  insurance_mode text not null default 'self_pay_only' check (insurance_mode in ('existing', 'self_pay_only')),
  self_pay_enabled boolean not null default false,
  self_pay_fee numeric,
  self_pay_fee_label text,
  pricing_note text,
  hero_image_url text,
  hero_image_alt text,
  primary_cta_label text,
  primary_cta_href text,
  secondary_cta_label text,
  secondary_cta_href text,
  faqs jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  og_image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table telehealth_state_pages enable row level security;

-- Non-destructive seed: only inserts if these exact slugs don't already exist.
-- Content matches what was already live via the code fallback, so this is a
-- zero-visible-change migration — it only moves the source of truth into the
-- CMS. No self-pay fee is set for Massachusetts or Arizona (must not invent
-- one); the "Contact us for current self-pay pricing" fallback message is
-- applied by the frontend when self_pay_fee is null, not stored here.
insert into telehealth_state_pages (
  state_name, state_code, slug, published, badge, heading, subheading, body, care_mode,
  insurance_mode, self_pay_enabled, self_pay_fee, self_pay_fee_label, pricing_note,
  primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href,
  faqs, seo_title, seo_description, sort_order
) values
(
  'Florida', 'FL', 'florida', true,
  'Now Accepting New Patients',
  'Psychiatric Care for Florida Residents',
  'Florida residents can see Lourdie Chachoute, FNP-C, PMHNP-BC, either by secure telehealth from anywhere in the state or in person at our Orlando office — whichever fits your schedule and preference.',
  'Both options include the same personalized psychiatric evaluations, medication management, and ongoing follow-up care.',
  'Telehealth + in-person at our Orlando office',
  'existing', false, null, null, null,
  'Book an Appointment', '/book-telehealth-mental-health-appointment#charm-calendar',
  'View Fees & Insurance', '/fees-insurance',
  '[
    {"question": "Can I choose between a telehealth visit and an in-person visit?", "answer": "Yes. Florida residents can schedule either a secure telehealth appointment or an in-person visit at our Orlando office, and can switch between the two as your needs change."},
    {"question": "Where is your office located?", "answer": "3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828."},
    {"question": "Do I need to live in Orlando to be seen in person?", "answer": "No — any Florida resident is welcome to schedule an in-person visit at our Orlando office, or use telehealth if travel is not convenient."}
  ]'::jsonb,
  'Telehealth & In-Person Psychiatric Care in Florida',
  'Psychiatric evaluations and medication management for Florida residents — by secure telehealth statewide, or in person at our Orlando office.',
  0
),
(
  'Massachusetts', 'MA', 'massachusetts', true,
  'Telehealth Now Available in Massachusetts',
  'Telehealth Psychiatric Care for Massachusetts Residents',
  'LifeWell Family Health & Psychiatry provides secure telehealth psychiatric care to patients located in Massachusetts. There is no physical office in Massachusetts — every visit takes place by secure video from wherever you are.',
  'Massachusetts patients receive the same personalized psychiatric evaluations, medication management, and follow-up care offered to every patient, delivered entirely online. Care in Massachusetts is currently self-pay only.',
  'Telehealth only',
  'self_pay_only', true, null, null, null,
  'Book an Appointment', '/book-telehealth-mental-health-appointment#charm-calendar',
  'Meet Your Provider', '/bio',
  '[
    {"question": "Is telehealth psychiatric care legal in Massachusetts?", "answer": "Yes. Telehealth psychiatric care is a recognized, legal way to receive mental health treatment in Massachusetts when delivered by a provider licensed to treat patients in the state."},
    {"question": "Do you have an office in Massachusetts?", "answer": "No. Care for Massachusetts residents is provided entirely by telehealth. Our only physical office is in Orlando, Florida."},
    {"question": "Do you accept insurance in Massachusetts?", "answer": "Care for Massachusetts residents is currently self-pay only. Contact us for current self-pay pricing."},
    {"question": "What do I need for a telehealth visit from Massachusetts?", "answer": "A stable internet connection, a computer, tablet, or smartphone, and a private space for your appointment. You will need to be physically located in Massachusetts at the time of your visit."}
  ]'::jsonb,
  'Telehealth Psychiatric Care in Massachusetts',
  'Secure, self-pay telehealth psychiatric evaluations and medication management for Massachusetts residents, from a licensed psychiatric-mental health nurse practitioner.',
  1
),
(
  'Arizona', 'AZ', 'arizona', true,
  'Telehealth Now Available in Arizona',
  'Telehealth Psychiatric Care for Arizona Residents',
  'LifeWell Family Health & Psychiatry provides secure telehealth psychiatric care to patients located in Arizona. There is no physical office in Arizona — every visit takes place by secure video from wherever you are.',
  'Arizona patients receive the same personalized psychiatric evaluations, medication management, and follow-up care offered to every patient, delivered entirely online. Care in Arizona is currently self-pay only.',
  'Telehealth only',
  'self_pay_only', true, null, null, null,
  'Book an Appointment', '/book-telehealth-mental-health-appointment#charm-calendar',
  'Meet Your Provider', '/bio',
  '[
    {"question": "Is telehealth psychiatric care legal in Arizona?", "answer": "Yes. Telehealth psychiatric care is a recognized, legal way to receive mental health treatment in Arizona when delivered by a provider licensed to treat patients in the state."},
    {"question": "Do you have an office in Arizona?", "answer": "No. Care for Arizona residents is provided entirely by telehealth. Our only physical office is in Orlando, Florida."},
    {"question": "Do you accept insurance in Arizona?", "answer": "Care for Arizona residents is currently self-pay only. Contact us for current self-pay pricing."},
    {"question": "What do I need for a telehealth visit from Arizona?", "answer": "A stable internet connection, a computer, tablet, or smartphone, and a private space for your appointment. You will need to be physically located in Arizona at the time of your visit."}
  ]'::jsonb,
  'Telehealth Psychiatric Care in Arizona',
  'Secure, self-pay telehealth psychiatric evaluations and medication management for Arizona residents, from a licensed psychiatric-mental health nurse practitioner.',
  2
)
on conflict (slug) do nothing;

-- Resource Hub CMS migration: move the 3 real (non-placeholder) static
-- articles from client/src/data/generated/posts.ts into blog_posts, so they
-- become Admin-editable. Content, category, related service, publish date,
-- and author byline are copied verbatim from the static source — nothing
-- rewritten, no new claims added. cover_image_url/seo_title/seo_description
-- are left null because the static source never set any (the CMS article
-- page falls back to title/excerpt when those are blank). Slug-keyed
-- "on conflict do nothing" so this never overwrites a conflicting record.
insert into blog_posts (
  slug, title, excerpt, body, cover_image_url, author_name, category,
  related_service_slug, published, published_at, seo_title, seo_description, og_image_url
) values
(
  'understanding-anxiety-symptoms-and-when-to-seek-help',
  'Understanding Anxiety: Symptoms and When to Seek Help',
  'Occasional worry is a normal part of life, but persistent or overwhelming anxiety can be a sign it''s time to talk with a psychiatric provider. Here''s what to look for.',
  'Everyone feels anxious sometimes — before a big presentation, a difficult conversation, or an important decision. That kind of worry is a normal, even useful, part of life. Anxiety becomes a different matter when it''s persistent, disproportionate to the situation, or when it starts interfering with your work, relationships, or day-to-day functioning.

Common symptoms of anxiety

Anxiety shows up differently for different people, but common signs include:

- Persistent worry that''s hard to control or that lasts most days for weeks or longer
- Restlessness, feeling on edge, or difficulty relaxing
- Trouble concentrating, or your mind going blank
- Muscle tension, headaches, or a racing heart
- Sleep problems — trouble falling asleep, staying asleep, or restless sleep
- Avoiding situations, people, or responsibilities because they trigger worry
- Irritability that feels out of proportion to what''s actually happening

When anxiety may need professional support

Not every anxious moment calls for treatment. It''s worth talking with a psychiatric provider when anxiety is frequent, hard to control, or is affecting your sleep, work, relationships, or physical health — even if you''re not sure it "counts" as a problem. You don''t need to wait until anxiety becomes severe to ask for help.

How psychiatric care can help

A psychiatric evaluation looks at your symptoms, history, and day-to-day life to understand what''s driving your anxiety and how it''s affecting you. From there, care may include medication management when appropriate, along with practical lifestyle guidance and coping strategies — tailored to your specific situation rather than a one-size-fits-all plan. If ongoing talk therapy would also be helpful, your provider can discuss that as part of a coordinated plan.

Getting started

If anxiety has been affecting your daily life, a psychiatric evaluation is a reasonable first step. Appointments are available by secure telehealth or in person at our Orlando office.',
  null,
  'Lourdie Chachoute, FNP-C, PMHNP-BC, RRT, CCRN',
  'Anxiety',
  'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd',
  true,
  '2026-08-28T00:00:00Z',
  null,
  null,
  null
),
(
  'adult-adhd-what-to-know-about-evaluation-and-treatment',
  'Adult ADHD: What to Know About Evaluation and Treatment',
  'ADHD often goes undiagnosed into adulthood. Here''s what the common signs look like, what a psychiatric evaluation involves, and how treatment is approached.',
  'ADHD is often thought of as a childhood condition, but many adults live for years with undiagnosed ADHD — sometimes finding out only after a child or family member is diagnosed and the symptoms start to sound familiar.

Common signs of adult ADHD

Adult ADHD can look different from the hyperactivity often associated with children. Common signs include:

- Trouble focusing or staying on task, especially with routine or tedious work
- Frequently losing track of time, deadlines, or appointments
- Difficulty organizing tasks or managing multiple responsibilities
- Restlessness or feeling mentally "on the go"
- Impulsivity in decisions, spending, or conversations
- A pattern of starting projects with enthusiasm but struggling to finish them
- Feeling like you have to work much harder than others to keep up

What a psychiatric evaluation for ADHD involves

An evaluation typically includes a detailed conversation about your current symptoms, how long they''ve been present, and how they affect your work, relationships, and daily life. Because ADHD symptoms can overlap with anxiety, depression, and other conditions, your provider will also ask about your broader mental health history to understand the full picture before recommending a treatment approach.

Treatment options

Treatment is individualized. For many adults, it includes medication management, paired with practical strategies for organization, time management, and daily routines. Your provider will work with you to find an approach that fits your symptoms, goals, and any other health conditions you''re managing.

Getting started

If ADHD symptoms are affecting your work or daily life, a psychiatric evaluation can help clarify what''s going on and what treatment options make sense. Appointments are available by secure telehealth or in person at our Orlando office.',
  null,
  'Lourdie Chachoute, FNP-C, PMHNP-BC, RRT, CCRN',
  'ADHD',
  'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd',
  true,
  '2026-08-28T00:00:00Z',
  null,
  null,
  null
),
(
  'what-happens-during-a-psychiatric-evaluation',
  'What Happens During a Psychiatric Evaluation',
  'Not sure what to expect from your first psychiatric evaluation? Here''s a clear walkthrough of how the appointment works, from preparation to your treatment plan.',
  'Booking your first psychiatric evaluation can feel like a big step, especially if you''re not sure what to expect. Here''s a straightforward look at how the appointment typically works.

Before your appointment

It helps to come prepared, though nothing here is required:

- A general list of the symptoms or concerns you''d like to discuss
- Any medications or supplements you currently take, including dosages
- A brief mental health and medical history, including past diagnoses or treatment
- Questions you have about treatment options

During the evaluation

Your provider will ask about your current symptoms, when they started, and how they''re affecting your daily life — work, relationships, sleep, and overall functioning. You''ll also be asked about your broader health and mental health history. This is a conversation, not a test: there are no right or wrong answers, and the goal is to understand your full picture before recommending next steps.

After the evaluation

Based on the evaluation, your provider will discuss a personalized plan with you, which may include medication management, lifestyle guidance, and a schedule for follow-up visits to monitor how treatment is working and make adjustments as needed.

Telehealth evaluations

A psychiatric evaluation by telehealth works the same way as an in-person visit — you''ll just need a private space, a stable internet connection, and a computer, tablet, or smartphone.',
  null,
  'Lourdie Chachoute, FNP-C, PMHNP-BC, RRT, CCRN',
  'Psychiatric Care & Evaluations',
  'psychiatric-evaluations',
  true,
  '2026-08-28T00:00:00Z',
  null,
  null,
  null
)
on conflict (slug) do nothing;

-- P4-I2A: Marketing Contacts / Email Directory.
--
-- A marketing contact list, NOT a clinical patient database — no diagnosis,
-- medication, symptom, clinical-note, treatment-plan, appointment-note, or
-- psychiatric-history field exists here, and none should ever be added.
-- Deliberately excludes a free-text `notes` column for the same reason this
-- codebase already minimizes other free-text fields (leads.message/subject,
-- the public Contact form's reason enum): an open narrative field on a
-- contact record invites exactly the kind of accidental sensitive content
-- this table must never hold.
--
-- Consent/status invariant: `marketing_status` defaults to 'pending', never
-- 'subscribed' — no default or trigger here can ever make a contact
-- sendable. Only a future, explicit application-layer action may do that.
create table if not exists marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  -- As-submitted email, preserved for display.
  email text not null check (length(trim(email)) > 0),
  -- Authoritative dedupe key. GENERATED (not a plain column the app writes
  -- to) so email/email_normalized can never disagree — Postgres computes
  -- and stores this itself on every insert/update, and rejects any attempt
  -- to write to it directly. This is what makes normalized uniqueness a
  -- database guarantee rather than an application-trusted convention.
  email_normalized text generated always as (lower(trim(email))) stored unique,
  first_name text,
  last_name text,
  -- Segmentation only — must never be read as implying marketing consent.
  audience_type text not null default 'other'
    check (audience_type in ('existing_patient', 'prospective_patient', 'subscriber', 'other')),
  -- Provenance. Limited to mechanisms that actually exist in this
  -- repository today — no integration-specific source is listed until the
  -- integration itself exists.
  source text not null default 'manual'
    check (source in ('manual', 'csv_import', 'website_signup', 'other')),
  -- The actual sendability gate. 'subscribed' is the only sendable value;
  -- everything else (including the default) is non-sendable.
  marketing_status text not null default 'pending'
    check (marketing_status in ('pending', 'subscribed', 'unsubscribed', 'suppressed')),
  -- Reuses the same controlled vocabulary as `source` rather than inventing
  -- a second, unevidenced enum for how consent was obtained.
  consent_source text
    check (consent_source is null or consent_source in ('manual', 'csv_import', 'website_signup', 'other')),
  -- Nullable on purpose: a legitimately-consented historical import may not
  -- carry an exact original timestamp. The CHECK below requires knowing HOW
  -- consent was obtained (consent_source) before a row may be 'subscribed',
  -- without also requiring WHEN, which would make honest historical imports
  -- impossible to represent.
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  suppressed_at timestamptz,
  -- Deliberately left as unconstrained text, not a controlled enum: no
  -- repository or product evidence yet establishes a real suppression-cause
  -- taxonomy, and inventing one here would be a guess. This is a known,
  -- disclosed tradeoff — a future Server/Admin layer should constrain this
  -- to a fixed set of accepted values via application-level validation once
  -- real usage patterns are observed, the same way every other business
  -- rule in this app lives in Zod rather than a DB CHECK.
  suppression_reason text,
  created_at timestamptz not null default now(),
  -- No trigger — matches every other table in this schema; the future
  -- Server API sets this explicitly on update, the same way crudFactory.ts
  -- already does for every other resource.
  updated_at timestamptz not null default now(),
  -- The one status/consent consistency rule enforced at the DB level: a
  -- 'subscribed' row must at least know HOW consent was obtained. Every
  -- other status/timestamp combination (including an unsubscribed/
  -- suppressed row with no timestamp, e.g. an imported list that doesn't
  -- carry an exact historical date) is deliberately left unconstrained so a
  -- legitimate historical import is never impossible to represent. Sticky
  -- unsubscribe/suppression transition rules belong to the future Server
  -- API and CSV import logic, not a DB trigger — this phase does not
  -- introduce one.
  check (marketing_status <> 'subscribed' or consent_source is not null)
);

create index if not exists marketing_contacts_status_idx on marketing_contacts (marketing_status);
create index if not exists marketing_contacts_audience_idx on marketing_contacts (audience_type);
create index if not exists marketing_contacts_created_idx on marketing_contacts (created_at desc);

alter table marketing_contacts enable row level security;
-- Zero policies — same default-deny posture as every other table (see the
-- RLS posture note in schema.sql). Access will be exclusively through the
-- future authenticated Server API using the existing service-role client.

notify pgrst, 'reload schema';
