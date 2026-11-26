-- signup/login schema for ku open house
-- just run it in the supabase sql editor

create extension if not exists pgcrypto; -- for password hashing


-- schools
create table schools (
  id serial primary key,
  name varchar(200) not null unique,
  province varchar(100),
  created_at timestamptz not null default now()
);

-- grade levels, P1 - M6
create table grade_levels (
  id serial primary key,
  code varchar(10) not null unique,  -- P1, M6 ...
  name varchar(50) not null,
  sort_order int not null
);

create table users (
  id uuid primary key default gen_random_uuid(),
  username varchar(50) not null unique,
  password_hash text not null,
  school_id int references schools(id) on delete set null,
  grade_level_id int references grade_levels(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_.]{3,50}$')
);

create index idx_users_school on users(school_id);
create index idx_users_grade on users(grade_level_id);


-- RLS
-- must be on, otherwise anyone can pull password_hash through the api
alter table users enable row level security;
alter table schools enable row level security;
alter table grade_levels enable row level security;

-- schools and grade_levels are public, they feed the dropdowns
create policy "public read schools" on schools for select using (true);
create policy "public read grades" on grade_levels for select using (true);
-- no policy on users -> only reachable through the functions below


insert into grade_levels (code, name, sort_order) values
  ('P1', 'ประถมศึกษาปีที่ 1', 1),
  ('P2', 'ประถมศึกษาปีที่ 2', 2),
  ('P3', 'ประถมศึกษาปีที่ 3', 3),
  ('P4', 'ประถมศึกษาปีที่ 4', 4),
  ('P5', 'ประถมศึกษาปีที่ 5', 5),
  ('P6', 'ประถมศึกษาปีที่ 6', 6),
  ('M1', 'มัธยมศึกษาปีที่ 1', 7),
  ('M2', 'มัธยมศึกษาปีที่ 2', 8),
  ('M3', 'มัธยมศึกษาปีที่ 3', 9),
  ('M4', 'มัธยมศึกษาปีที่ 4', 10),
  ('M5', 'มัธยมศึกษาปีที่ 5', 11),
  ('M6', 'มัธยมศึกษาปีที่ 6', 12);


-- sign up
create or replace function register_user(
  p_username text,
  p_password text,
  p_school_id int,
  p_grade_level_id int
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  insert into users (username, password_hash, school_id, grade_level_id)
  values (p_username, crypt(p_password, gen_salt('bf')), p_school_id, p_grade_level_id)
  returning id into new_id;

  return new_id;
end;
$$;

-- login: returns the id, or null if wrong
create or replace function login_user(p_username text, p_password text)
returns uuid
language sql
security definer
set search_path = public, extensions
as $$
  select id from users
  where username = p_username
    and password_hash = crypt(p_password, password_hash);
$$;


-- user changes their own password, old one has to match
-- true if changed, false if user/old password is wrong
create or replace function change_password(
  p_username text,
  p_old_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(p_new_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where username = p_username
    and password_hash = crypt(p_old_password, password_hash);

  return found;
end;
$$;

-- admin reset for forgotten passwords, no old password needed
-- server side only, with the service_role key
create or replace function admin_reset_password(
  p_username text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(p_new_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where username = p_username;

  return found;
end;
$$;

-- important: functions are callable by everyone by default, lock this one down
revoke execute on function admin_reset_password(text, text) from public, anon, authenticated;
grant execute on function admin_reset_password(text, text) to service_role;


-- users with school/grade names
create or replace view user_profiles with (security_invoker = true) as
select u.id, u.username, s.name as school, g.name as grade, u.created_at
from users u
left join schools s on s.id = u.school_id
left join grade_levels g on g.id = u.grade_level_id;


-- test data, delete whenever
insert into schools (name, province) values
  ('โรงเรียนตัวอย่างวิทยา', 'กรุงเทพมหานคร'),
  ('โรงเรียนสาธิตทดสอบ', 'เชียงใหม่');

select register_user('student01', 'password123', 1, 10); -- M4
select register_user('student02', 'mypassword9', 2, 7);  -- M1

-- select login_user('student01', 'password123');
-- select login_user('student01', 'wrongpass');
