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

notify pgrst, 'reload schema';
