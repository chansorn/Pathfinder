-- PathFinder schema
-- paste the whole thing into Supabase > SQL Editor and run. safe to re-run.
-- accounts live in Supabase Auth (auth.users), everything else hangs off profiles.
-- RLS is on everywhere: users only ever see their own rows.


-- lookup tables (readable by anyone)

create table if not exists public.schools (
  id serial primary key,
  name varchar(200) not null unique,
  province varchar(100)
);

create table if not exists public.grade_levels (
  id serial primary key,
  code varchar(10) not null unique,
  name varchar(50) not null
);

insert into public.grade_levels (code, name) values
  ('M4', 'มัธยมศึกษาปีที่ 4'),
  ('M5', 'มัธยมศึกษาปีที่ 5'),
  ('M6', 'มัธยมศึกษาปีที่ 6')
on conflict (code) do nothing;

-- makes the ilike search in GET /api/schools?q= fast even with thousands of schools
create extension if not exists pg_trgm with schema extensions;
create index if not exists idx_schools_name_trgm on public.schools using gin (name extensions.gin_trgm_ops);
create index if not exists idx_schools_province on public.schools (province);

-- sample data, replace with real schools
insert into public.schools (name, province) values
  ('โรงเรียนตัวอย่างวิทยา', 'กรุงเทพมหานคร'),
  ('โรงเรียนสาธิตทดสอบ', 'เชียงใหม่')
on conflict (name) do nothing;


-- TCAS reference data (public read, written only by scripts/import-tcas.js with the service role)
-- academic_year is the Thai year, e.g. 2569

create table if not exists public.tcas_programs (
  id uuid primary key default gen_random_uuid(),
  academic_year int not null,
  university varchar(200) not null,
  faculty varchar(200) not null,
  program varchar(300) not null,
  campus varchar(200) not null default '',
  url text,
  tuition_note text,
  updated_at timestamptz not null default now(),
  unique (academic_year, university, faculty, program, campus)
);

create table if not exists public.tcas_admissions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.tcas_programs(id) on delete cascade,
  round smallint not null check (round between 1 and 4),
  project_name varchar(300) not null,
  seats int check (seats >= 0),
  min_gpax numeric(3,2) check (min_gpax between 0 and 4),
  requirements text,
  score_weights jsonb,          -- { "TGAT": 20, "TPAT3": 30, "A-Level คณิตศาสตร์ประยุกต์ 1": 25 }
  last_year_min_score numeric(8,2),
  source_url text,
  notes text
);

create table if not exists public.tcas_calendar (
  id uuid primary key default gen_random_uuid(),
  academic_year int not null,
  round smallint check (round between 1 and 4),
  event varchar(300) not null,
  start_date date not null,
  end_date date,
  source_url text
);

-- per-project application window, and per-university calendar rows (university null = central TCAS event)
alter table public.tcas_admissions add column if not exists apply_start date;
alter table public.tcas_admissions add column if not exists apply_end date;
alter table public.tcas_calendar add column if not exists university varchar(200);

create extension if not exists pg_trgm with schema extensions;
create index if not exists idx_tcas_programs_year on public.tcas_programs (academic_year);
create index if not exists idx_tcas_calendar_university on public.tcas_calendar (academic_year, university);
create index if not exists idx_tcas_programs_university_trgm on public.tcas_programs using gin (university extensions.gin_trgm_ops);
create index if not exists idx_tcas_programs_faculty_trgm on public.tcas_programs using gin (faculty extensions.gin_trgm_ops);
create index if not exists idx_tcas_programs_program_trgm on public.tcas_programs using gin (program extensions.gin_trgm_ops);
create index if not exists idx_tcas_admissions_program on public.tcas_admissions (program_id, round);
create index if not exists idx_tcas_calendar_year on public.tcas_calendar (academic_year, start_date);


-- user data

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(100) not null default '',
  school_id int references public.schools(id) on delete set null,
  grade_level_id int references public.grade_levels(id) on delete set null,
  gpax numeric(3,2) check (gpax between 0 and 4),
  subject_grades jsonb not null default '{}'::jsonb,   -- { "คณิตศาสตร์": 3.5 }
  interests text[] not null default '{}',
  skills text[] not null default '{}',
  activities jsonb not null default '[]'::jsonb,       -- [{ name, role, year, description }]
  awards jsonb not null default '[]'::jsonb,           -- [{ name, level, year }]
  target_faculties jsonb not null default '[]'::jsonb, -- [{ faculty, university }]
  terms_version varchar(20),          -- last terms/privacy policy version they accepted (PDPA)
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- for databases created from an earlier version of this file
alter table public.profiles add column if not exists terms_version varchar(20);
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('faculty', 'career', 'portfolio', 'skill')),
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tcas_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target jsonb not null, -- { faculty, university }
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_type text not null check (exam_type in ('TGAT', 'TPAT', 'A-Level', 'อื่นๆ')),
  subject varchar(100) not null,
  score numeric(7,2) not null check (score >= 0),
  max_score numeric(7,2) not null check (max_score > 0),
  taken_at date,
  created_at timestamptz not null default now(),
  check (score <= max_score)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- fingerprint of the AI input, lets us reuse an answer when nothing changed
alter table public.assessments add column if not exists input_hash text;
alter table public.recommendations add column if not exists input_hash text;
alter table public.tcas_plans add column if not exists input_hash text;

create index if not exists idx_assessments_hash on public.assessments (user_id, input_hash);
create index if not exists idx_recommendations_hash on public.recommendations (user_id, input_hash);

-- high_yield = AI coach "which chapters to study first" (POST /api/coach/high-yield)
alter table public.recommendations drop constraint if exists recommendations_type_check;
alter table public.recommendations add constraint recommendations_type_check
  check (type in ('faculty', 'career', 'portfolio', 'skill', 'high_yield'));
create index if not exists idx_tcas_plans_hash on public.tcas_plans (user_id, input_hash);

-- programs a student bookmarked (compare / deadline reminders)
create table if not exists public.saved_programs (
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.tcas_programs(id) on delete cascade,
  note varchar(500),
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

-- share links behind the QR code. snapshot = copy of the AI result at share time (no profile data)
-- token is 16 random bytes in base64url; the public read goes through the backend's service client
create table if not exists public.shared_links (
  token varchar(32) primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind varchar(20) not null check (kind in ('tcas', 'assessment', 'faculty', 'career', 'portfolio', 'skill')),
  source_id uuid not null,
  snapshot jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shared_links_user on public.shared_links (user_id, created_at desc);

-- app state the frontend keeps in localStorage (PF_STATE), synced when logged in.
-- one row per user, validated by the backend (src/schemas/state.schema.js). never sent to the AI
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- analytics page (page 7): one row per progress snapshot (check-in, waypoint done, reroute ...).
-- metrics are numbers the frontend already shows (readiness %, GPAX, hours), never sent to the AI
create table if not exists public.progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type varchar(30) not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_progress_snapshots_user on public.progress_snapshots (user_id, created_at desc);

-- roadmap checklist. item_key comes from the frontend (generated tasks keep a stable key),
-- custom tasks get "custom-<random>"
create table if not exists public.plan_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key varchar(100) not null,
  round smallint check (round between 1 and 4),
  tier varchar(20) not null default 'recommended' check (tier in ('required', 'recommended', 'optional')),
  title varchar(300) not null,
  detail jsonb not null default '{}'::jsonb,
  status varchar(20) not null default 'todo' check (status in ('todo', 'done', 'dismissed')),
  due_date date,
  source varchar(20) not null default 'system' check (source in ('system', 'custom', 'simulator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

-- official round 3 (Admission) max/min scores from mytcas.com/stat, one row per project per year.
-- loaded by scripts/import-cutoffs.js, matched to tcas_programs through program_code
create table if not exists public.tcas_cutoffs (
  id uuid primary key default gen_random_uuid(),
  academic_year int not null,
  round smallint not null default 3,
  program_code varchar(20) not null,
  university varchar(200) not null,
  faculty varchar(200),
  program text,                      -- some official names run past 400 chars
  detail text,                       -- project / major text, matches tcas_admissions.project_name
  seats int,
  applicants int,
  passed int,
  min_score numeric(10,4),           -- first processing
  max_score numeric(10,4),
  min_score_final numeric(10,4),     -- after the second processing (null if not published)
  source_url text not null
);

-- first version of this table had varchar(300/500) here, too short for some programs
alter table public.tcas_cutoffs alter column program type text;
alter table public.tcas_cutoffs alter column detail type text;

create index if not exists idx_tcas_cutoffs_code on public.tcas_cutoffs (program_code, academic_year);

-- myTCAS program code (e.g. 10020105300501A), pulled out of the program page url
alter table public.tcas_programs add column if not exists program_code varchar(20);
update public.tcas_programs
  set program_code = substring(url from 'programs/([0-9A-Za-z]+)')
  where program_code is null and url like '%course.mytcas.com/programs/%';
create index if not exists idx_tcas_programs_code on public.tcas_programs (program_code);

-- profile settings page
alter table public.profiles add column if not exists nickname varchar(50);
alter table public.profiles add column if not exists bio varchar(500);
alter table public.profiles add column if not exists target_tcas_year int check (target_tcas_year between 2560 and 2650);
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_icon varchar(30);
alter table public.profiles add column if not exists avatar_frame_color varchar(7);
alter table public.profiles add column if not exists avatar_bg_color varchar(7);
-- demo accounts (POST /api/auth/demo) are left out of /api/stats and deleted after a few hours
alter table public.profiles add column if not exists is_demo boolean not null default false;

-- profile photos. public bucket = the url works in <img> without a token.
-- uploads go through the backend (it checks size + file type), so no storage policies for clients
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create index if not exists idx_tcas_admissions_apply_end on public.tcas_admissions (apply_end);

create index if not exists idx_assessments_user on public.assessments (user_id, created_at desc);
create index if not exists idx_recommendations_user on public.recommendations (user_id, type, created_at desc);
create index if not exists idx_tcas_plans_user on public.tcas_plans (user_id, created_at desc);
create index if not exists idx_exam_scores_user on public.exam_scores (user_id, created_at desc);
create index if not exists idx_chat_messages_user on public.chat_messages (user_id, created_at desc);


-- triggers

-- keep profiles.updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_state_updated_at on public.user_state;
create trigger user_state_updated_at
  before update on public.user_state
  for each row execute function public.set_updated_at();

drop trigger if exists plan_items_updated_at on public.plan_items;
create trigger plan_items_updated_at
  before update on public.plan_items
  for each row execute function public.set_updated_at();

-- create the profile row on signup, from the metadata the backend passes to signUp
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, school_id, grade_level_id, terms_version, terms_accepted_at, is_demo)
  values (
    new.id,
    -- google sign-in puts the name in full_name / name instead
    left(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ), 100),
    nullif(new.raw_user_meta_data ->> 'school_id', '')::int,
    nullif(new.raw_user_meta_data ->> 'grade_level_id', '')::int,
    nullif(new.raw_user_meta_data ->> 'terms_version', ''),
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz,
    coalesce((new.raw_user_meta_data ->> 'is_demo')::boolean, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- RLS

alter table public.schools enable row level security;
alter table public.grade_levels enable row level security;
alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.recommendations enable row level security;
alter table public.tcas_plans enable row level security;
alter table public.exam_scores enable row level security;
alter table public.chat_messages enable row level security;
alter table public.tcas_programs enable row level security;
alter table public.tcas_admissions enable row level security;
alter table public.tcas_calendar enable row level security;
alter table public.saved_programs enable row level security;
alter table public.shared_links enable row level security;
alter table public.user_state enable row level security;
alter table public.plan_items enable row level security;
alter table public.progress_snapshots enable row level security;
alter table public.tcas_cutoffs enable row level security;

-- TCAS data is public. no insert/update/delete policy -> only the service role can write
drop policy if exists "read tcas programs" on public.tcas_programs;
create policy "read tcas programs" on public.tcas_programs for select using (true);
drop policy if exists "read tcas admissions" on public.tcas_admissions;
create policy "read tcas admissions" on public.tcas_admissions for select using (true);
drop policy if exists "read tcas calendar" on public.tcas_calendar;
create policy "read tcas calendar" on public.tcas_calendar for select using (true);
drop policy if exists "read tcas cutoffs" on public.tcas_cutoffs;
create policy "read tcas cutoffs" on public.tcas_cutoffs for select using (true);

-- (select auth.uid()) instead of auth.uid() so postgres evaluates it once per query, not per row

drop policy if exists "read schools" on public.schools;
create policy "read schools" on public.schools for select using (true);

drop policy if exists "read grade levels" on public.grade_levels;
create policy "read grade levels" on public.grade_levels for select using (true);

-- profiles: id = user id
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- tables with user_id: full access, own rows only
do $$
declare
  t text;
begin
  foreach t in array array['assessments', 'recommendations', 'tcas_plans', 'exam_scores', 'chat_messages', 'saved_programs', 'shared_links', 'user_state', 'plan_items', 'progress_snapshots']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end;
$$;
