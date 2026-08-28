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

notify pgrst, 'reload schema';
