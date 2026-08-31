-- Run once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

-- [REPAIR SECTION] Ensure existing tables have the latest columns
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'is_deleted') THEN
            ALTER TABLE public.schools ADD COLUMN is_deleted boolean not null default false;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_sessions' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'test_sessions' AND column_name = 'teaching_period') THEN
            ALTER TABLE public.test_sessions ADD COLUMN teaching_period text not null default '';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'test_sessions' AND column_name = 'term') THEN
            ALTER TABLE public.test_sessions ADD COLUMN term text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'test_sessions' AND column_name = 'academic_year') THEN
            ALTER TABLE public.test_sessions ADD COLUMN academic_year text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'test_sessions' AND column_name = 'test_end_date') THEN
            ALTER TABLE public.test_sessions ADD COLUMN test_end_date date;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'left_at') THEN
            ALTER TABLE public.students ADD COLUMN left_at date;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classrooms' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classrooms' AND column_name = 'is_deleted') THEN
            ALTER TABLE public.classrooms ADD COLUMN is_deleted boolean not null default false;
            ALTER TABLE public.classrooms ADD COLUMN updated_at timestamptz not null default now();
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_sessions' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'test_sessions' AND column_name = 'is_deleted') THEN
            ALTER TABLE public.test_sessions ADD COLUMN is_deleted boolean not null default false;
            ALTER TABLE public.test_sessions ADD COLUMN updated_at timestamptz not null default now();
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'onsite_evaluations' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'onsite_evaluations' AND column_name = 'is_deleted') THEN
            ALTER TABLE public.onsite_evaluations ADD COLUMN is_deleted boolean not null default false;
            ALTER TABLE public.onsite_evaluations ADD COLUMN updated_at timestamptz not null default now();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'onsite_evaluations' AND column_name = 'end_date') THEN
            ALTER TABLE public.onsite_evaluations ADD COLUMN end_date date;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_requests' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teacher_requests' AND column_name = 'note') THEN
            ALTER TABLE public.teacher_requests ADD COLUMN note text not null default '';
        END IF;
    END IF;
END $$;

-- Table Definitions
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '', full_name text not null default '',
  role text not null default 'viewer' check (role in ('super_admin','school_admin','evaluator','viewer','pending')),
  created_at timestamptz not null default now()
);

-- Upgrade profiles created by an older schema.
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles alter column role set default 'viewer';
update public.profiles set role='school_admin' where role='admin';
update public.profiles set role='viewer' where role='pending';
alter table public.profiles add constraint profiles_role_check check (role in ('super_admin','school_admin','evaluator','viewer','pending'));

create table if not exists public.offices (
  id text primary key, name text not null, active boolean not null default true,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create unique index if not exists offices_unique_active_name on public.offices(lower(btrim(name))) where active=true;

create table if not exists public.schools (
  id text primary key, name text not null, academic_year text not null, term text not null,
  office_id text references public.offices(id) on delete set null,
  is_deleted boolean not null default false,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.schools add column if not exists office_id text references public.offices(id) on delete set null;

-- Keep the newest active record when the same school/academic year/term was imported more than once.
-- Older copies are soft-deleted, so their related data remains recoverable.
with duplicate_schools as (
  select id,row_number() over (
    partition by lower(btrim(name)),btrim(academic_year),btrim(term)
    order by updated_at desc,created_at desc,id desc
  ) as duplicate_rank
  from public.schools
  where is_deleted=false
)
update public.schools
set is_deleted=true,updated_at=now()
where id in (select id from duplicate_schools where duplicate_rank>1);

create unique index if not exists schools_unique_active_identity
on public.schools (lower(btrim(name)),btrim(academic_year),btrim(term))
where is_deleted=false;

create table if not exists public.school_members (
  school_id text references public.schools(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'evaluator' check (role in ('admin','evaluator')), primary key(school_id,user_id)
);

create table if not exists public.classrooms (
  id text primary key, school_id text not null references public.schools(id) on delete cascade, name text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id text primary key, classroom_id text not null references public.classrooms(id) on delete cascade,
  student_no integer not null, prefix text, first_name text, last_name text, full_name text not null, active boolean not null default true,
  left_at date, created_at timestamptz not null default now(), unique(classroom_id,student_no)
);

create table if not exists public.test_sessions (
  id text primary key, classroom_id text not null references public.classrooms(id) on delete cascade,
  test_name text not null, test_date date, test_end_date date, robot_type text, exam_set text, teaching_period text not null default '', trainer text, term text, academic_year text, detail text, summary text,
  locked boolean not null default false, is_deleted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.test_results (
  session_id text references public.test_sessions(id) on delete cascade, student_id text references public.students(id) on delete cascade,
  score numeric check(score between 0 and 50), time_value text, absent boolean not null default false, is_special boolean not null default false,
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(), primary key(session_id,student_id)
);

create table if not exists public.inventory_items (
  id text primary key,
  name text not null,
  category text not null default 'other',
  robot_type text,
  power_type text,
  field_type text,
  unit text not null default 'ชิ้น',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.inventory_items(id,name,category,robot_type,power_type,field_type,unit,sort_order) values
  ('code-go-battery','Code & Go แบบถ่าน','robot','Code & Go','battery',null,'ตัว',10),
  ('code-go-charge','Code & Go แบบชาร์จ','robot','Code & Go','rechargeable',null,'ตัว',20),
  ('botley-battery','Botley','robot','Botley','battery',null,'ตัว',30),
  ('botzees-charge','Botzees','robot','Botzees','rechargeable',null,'ตัว',40),
  ('mbot2-charge','Mbot2','robot','Mbot2','rechargeable',null,'ตัว',50),
  ('aa-battery','ถ่าน AA','consumable',null,'battery',null,'ก้อน',60),
  ('code-go-battery-charger','ที่ชาร์จถ่าน Code & Go','accessory','Code & Go','battery',null,'เครื่อง',70),
  ('botley-battery-charger','ที่ชาร์จถ่าน Botley','accessory','Botley','battery',null,'เครื่อง',75),
  ('code-go-charge-cable','สายชาร์จ Code & Go','accessory','Code & Go','rechargeable',null,'เส้น',80),
  ('botzees-charge-cable','สายชาร์จ Botzees','accessory','Botzees','rechargeable',null,'เส้น',85),
  ('mbot2-charge-cable','สายชาร์จ Mbot2','accessory','Mbot2','rechargeable',null,'เส้น',88),
  ('tablet','แท็บเล็ต','accessory',null,'rechargeable',null,'เครื่อง',90),
  ('field-code-go-vinyl','สนาม Code & Go ไวนิล','field','Code & Go',null,'vinyl','ชุด',100),
  ('field-code-go-mousepad','สนาม Code & Go แผ่นรองเมาส์','field','Code & Go',null,'mousepad','ชุด',110),
  ('field-botley-vinyl','สนาม Botley ไวนิล','field','Botley',null,'vinyl','ชุด',120),
  ('field-botley-mousepad','สนาม Botley แผ่นรองเมาส์','field','Botley',null,'mousepad','ชุด',130),
  ('field-botzees-vinyl','สนาม Botzees ไวนิล','field','Botzees',null,'vinyl','ชุด',140),
  ('field-botzees-mousepad','สนาม Botzees แผ่นรองเมาส์','field','Botzees',null,'mousepad','ชุด',150),
  ('field-mbot2-vinyl','สนาม Mbot2 ไวนิล','field','Mbot2',null,'vinyl','ชุด',160),
  ('field-mbot2-mousepad','สนาม Mbot2 แผ่นรองเมาส์','field','Mbot2',null,'mousepad','ชุด',170),
  ('field-vinyl','สนามไวนิล (ยังไม่ระบุหุ่น)','field',null,null,'vinyl','ชุด',900),
  ('field-mousepad','สนามแผ่นรองเมาส์ (ยังไม่ระบุหุ่น)','field',null,null,'mousepad','ชุด',910),
  ('battery-charger','ที่ชาร์จถ่าน (ยังไม่ระบุหุ่น)','accessory',null,null,null,'เครื่อง',920),
  ('charge-cable','สายชาร์จ (ยังไม่ระบุหุ่น)','accessory',null,'rechargeable',null,'เส้น',930)
on conflict(id) do update set
  name=excluded.name,
  category=excluded.category,
  robot_type=excluded.robot_type,
  power_type=excluded.power_type,
  field_type=excluded.field_type,
  unit=excluded.unit,
  sort_order=excluded.sort_order,
  active=true;

create table if not exists public.office_inventory (
  office_id text not null references public.offices(id) on delete cascade,
  item_id text not null references public.inventory_items(id) on delete cascade,
  quantity integer not null default 0 check(quantity >= 0),
  usable_quantity integer not null default 0 check(usable_quantity >= 0),
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(office_id,item_id)
);

create table if not exists public.school_inventory (
  school_id text not null references public.schools(id) on delete cascade,
  item_id text not null references public.inventory_items(id) on delete cascade,
  quantity integer not null default 0 check(quantity >= 0),
  usable_quantity integer not null default 0 check(usable_quantity >= 0),
  notes text not null default '',
  checked_at date,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(school_id,item_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('checkout','return','grant_to_school')),
  item_id text not null references public.inventory_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  from_owner_type text check (from_owner_type in ('office','school','event')),
  from_owner_id text,
  to_owner_type text check (to_owner_type in ('office','school','event')),
  to_owner_id text,
  related_school_id text references public.schools(id) on delete set null,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_requests (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(id) on delete cascade,
  classroom_id text not null references public.classrooms(id) on delete cascade,
  robot_type text not null,
  academic_term text not null,
  teaching_period text not null,
  note text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

with ranked_pending_requests as (
  select id,
    row_number() over (
      partition by school_id, classroom_id
      order by created_at desc, id desc
    ) as rn
  from public.teacher_requests
  where status = 'pending'
)
update public.teacher_requests tr
set status = 'duplicate', updated_at = now()
from ranked_pending_requests r
where tr.id = r.id and r.rn > 1;

create unique index if not exists teacher_requests_unique_pending_classroom
on public.teacher_requests (school_id, classroom_id)
where status = 'pending';

create or replace function public.normalize_teacher_school_name(p_name text)
returns text
language sql
immutable
set search_path=public
as $$
  select regexp_replace(
    regexp_replace(
      translate(lower(btrim(coalesce(p_name, ''))), '๐๑๒๓๔๕๖๗๘๙', '0123456789'),
      '^(โรงเรียน|รร\.?|ร\.ร\.)[[:space:]]*',
      ''
    ),
    '[[:space:].()（）\-_\/]+',
    '',
    'g'
  )
$$;

create or replace function public.teacher_request_school_lookup(p_school_name text)
returns table (
  school_id text,
  school_name text,
  office_id text,
  classroom_id text,
  classroom_name text,
  is_pending boolean
)
language sql
stable
security definer
set search_path=public
as $$
  with wanted as (
    select public.normalize_teacher_school_name(p_school_name) as normalized_name
  ),
  exact_schools as (
    select s.id, s.name, s.office_id, 1 as match_rank
    from public.schools s, wanted w
    where not s.is_deleted
      and public.normalize_teacher_school_name(s.name) = w.normalized_name
      and w.normalized_name <> ''
  ),
  partial_schools as (
    select s.id, s.name, s.office_id, 2 as match_rank
    from public.schools s, wanted w
    where not s.is_deleted
      and w.normalized_name <> ''
      and char_length(w.normalized_name) >= 3
      and public.normalize_teacher_school_name(s.name) like '%' || w.normalized_name || '%'
      and not exists (select 1 from exact_schools)
  ),
  matched_schools as (
    select * from exact_schools
    union all
    select * from partial_schools
  )
  select
    s.id as school_id,
    s.name as school_name,
    s.office_id,
    c.id as classroom_id,
    c.name as classroom_name,
    exists (
      select 1
      from public.teacher_requests tr
      where tr.school_id = s.id
        and tr.classroom_id = c.id
        and tr.status = 'pending'
    ) as is_pending
  from matched_schools s
  left join public.classrooms c on c.school_id = s.id and not c.is_deleted
  order by s.match_rank, s.name, c.created_at;
$$;

grant execute on function public.teacher_request_school_lookup(text) to anon, authenticated;

create or replace function public.save_teacher_requests(p_school_id text, p_requests jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  target_classroom_id text;
  inserted_count integer := 0;
  duplicate_classroom_ids text[] := '{}';
begin
  if jsonb_typeof(coalesce(p_requests, '[]'::jsonb)) <> 'array' then
    raise exception 'requests must be an array';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_requests, '[]'::jsonb)) loop
    target_classroom_id := item->>'classroom_id';

    if target_classroom_id is null or not exists (
      select 1
      from public.classrooms c
      where c.id = target_classroom_id
        and c.school_id = p_school_id
        and not c.is_deleted
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.teacher_requests tr
      where tr.school_id = p_school_id
        and tr.classroom_id = target_classroom_id
        and tr.status = 'pending'
    ) then
      duplicate_classroom_ids := array_append(duplicate_classroom_ids, target_classroom_id);
      continue;
    end if;

    begin
      insert into public.teacher_requests (
        school_id,
        classroom_id,
        robot_type,
        academic_term,
        teaching_period,
        status
      ) values (
        p_school_id,
        target_classroom_id,
        coalesce(nullif(item->>'robot_type', ''), 'Code & Go'),
        coalesce(nullif(item->>'academic_term', ''), ''),
        coalesce(nullif(item->>'teaching_period', ''), ''),
        'pending'
      );
      inserted_count := inserted_count + 1;
    exception when unique_violation then
      duplicate_classroom_ids := array_append(duplicate_classroom_ids, target_classroom_id);
    end;
  end loop;

  return jsonb_build_object(
    'inserted', inserted_count,
    'duplicates', coalesce(array_length(duplicate_classroom_ids, 1), 0),
    'duplicate_classroom_ids', coalesce(to_jsonb(duplicate_classroom_ids), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.save_teacher_requests(text,jsonb) to anon, authenticated;

create table if not exists public.onsite_evaluations (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(id) on delete cascade,
  classroom_id text not null references public.classrooms(id) on delete cascade,
  robot_type text,
  academic_term text,
  teaching_period text,
  trainer_name text not null,
  present_count integer not null default 0,
  absent_count integer not null default 0,
  issues text,
  suggestions text,
  eval_date date not null default current_date,
  end_date date,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add is_special for existing deployments
alter table public.test_results add column if not exists is_special boolean not null default false;

-- Foreign-key indexes keep school/classroom drill-down queries inexpensive.
create index if not exists schools_office_id_idx on public.schools(office_id) where is_deleted=false;
create index if not exists classrooms_school_id_idx on public.classrooms(school_id);
create index if not exists students_classroom_active_idx on public.students(classroom_id,active);
create index if not exists test_sessions_classroom_created_idx on public.test_sessions(classroom_id,created_at desc);
create index if not exists test_results_student_id_idx on public.test_results(student_id);
create index if not exists office_inventory_item_idx on public.office_inventory(item_id);
create index if not exists school_inventory_item_idx on public.school_inventory(item_id);
create index if not exists stock_movements_created_idx on public.stock_movements(created_at desc);
create index if not exists stock_movements_item_idx on public.stock_movements(item_id);
create index if not exists stock_movements_from_idx on public.stock_movements(from_owner_type,from_owner_id);
create index if not exists stock_movements_to_idx on public.stock_movements(to_owner_type,to_owner_id);

-- Handle new user profile
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,full_name,role)
 values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),'viewer')
 on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(excluded.full_name,''),public.profiles.full_name);
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill existing accounts and bootstrap the first system administrator.
insert into public.profiles(id,email,full_name,role)
select id,coalesce(email,''),coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name',''),
       case when id='33906f41-3eaf-45ca-a416-65c15992933c'::uuid then 'super_admin' else 'viewer' end
from auth.users
on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(excluded.full_name,''),public.profiles.full_name);
update public.profiles set role='super_admin' where id='33906f41-3eaf-45ca-a416-65c15992933c'::uuid;
update public.profiles set role='super_admin' where email='arsan113@gmail.com';

-- Security-definer helpers keep RLS checks non-recursive.
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='super_admin')
$$;
create or replace function public.can_access_school(sid text) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='viewer') or (
  exists(select 1 from public.profiles where id=auth.uid() and role in ('school_admin','evaluator')) and (
   exists(select 1 from public.schools where id=sid and created_by=auth.uid()) or
   exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid())
  )
 )
$$;
create or replace function public.can_edit_school(sid text) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or (
  exists(select 1 from public.profiles where id=auth.uid() and role in ('school_admin','evaluator')) and (
   exists(select 1 from public.schools where id=sid and created_by=auth.uid()) or
   exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid())
  )
 )
$$;
create or replace function public.can_admin_school(sid text) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or (
  exists(select 1 from public.profiles where id=auth.uid() and role='school_admin') and (
   exists(select 1 from public.schools where id=sid and created_by=auth.uid()) or
   exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and role='admin')
  )
 )
$$;

create or replace function public.apply_stock_movement(
  p_movement_type text,
  p_item_id text,
  p_quantity integer,
  p_from_office_id text default null,
  p_to_office_id text default null,
  p_school_id text default null,
  p_note text default ''
)
returns public.stock_movements
language plpgsql
security definer
set search_path=public
as $$
declare
  movement public.stock_movements%rowtype;
  target_owner_type text;
  target_owner_id text;
  source_owner_type text;
  source_owner_id text;
  affected_rows integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;

  if p_movement_type not in ('checkout','return','grant_to_school') then
    raise exception 'invalid movement type';
  end if;

  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('super_admin','school_admin')) then
    raise exception 'permission denied';
  end if;

  if not exists(select 1 from public.inventory_items where id=p_item_id and active=true) then
    raise exception 'invalid item';
  end if;

  if p_movement_type in ('checkout','grant_to_school') then
    if coalesce(p_from_office_id,'') = '' then
      raise exception 'from office is required';
    end if;

    update public.office_inventory
    set quantity=quantity-p_quantity,
        usable_quantity=usable_quantity-p_quantity,
        updated_by=auth.uid(),
        updated_at=now()
    where office_id=p_from_office_id
      and item_id=p_item_id
      and quantity>=p_quantity
      and usable_quantity>=p_quantity;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'not enough stock in source office';
    end if;

    source_owner_type := 'office';
    source_owner_id := p_from_office_id;
  end if;

  if p_movement_type='checkout' then
    target_owner_type := 'event';
    target_owner_id := coalesce(p_school_id, p_from_office_id);
  elsif p_movement_type='return' then
    if coalesce(p_to_office_id,'') = '' then
      raise exception 'to office is required';
    end if;

    insert into public.office_inventory(office_id,item_id,quantity,usable_quantity,updated_by,updated_at)
    values(p_to_office_id,p_item_id,p_quantity,p_quantity,auth.uid(),now())
    on conflict(office_id,item_id) do update set
      quantity=public.office_inventory.quantity+excluded.quantity,
      usable_quantity=public.office_inventory.usable_quantity+excluded.usable_quantity,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

    source_owner_type := 'event';
    source_owner_id := coalesce(p_school_id, p_to_office_id);
    target_owner_type := 'office';
    target_owner_id := p_to_office_id;
  elsif p_movement_type='grant_to_school' then
    if coalesce(p_school_id,'') = '' then
      raise exception 'school is required';
    end if;

    insert into public.school_inventory(school_id,item_id,quantity,usable_quantity,checked_at,updated_by,updated_at)
    values(p_school_id,p_item_id,p_quantity,p_quantity,current_date,auth.uid(),now())
    on conflict(school_id,item_id) do update set
      quantity=public.school_inventory.quantity+excluded.quantity,
      usable_quantity=public.school_inventory.usable_quantity+excluded.usable_quantity,
      checked_at=excluded.checked_at,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

    target_owner_type := 'school';
    target_owner_id := p_school_id;
  end if;

  insert into public.stock_movements(
    movement_type,item_id,quantity,
    from_owner_type,from_owner_id,
    to_owner_type,to_owner_id,
    related_school_id,note,created_by
  ) values (
    p_movement_type,p_item_id,p_quantity,
    source_owner_type,source_owner_id,
    target_owner_type,target_owner_id,
    nullif(p_school_id,''),coalesce(p_note,''),auth.uid()
  )
  returning * into movement;

  return movement;
end;
$$;

create or replace function public.admin_set_user_access(p_user_id uuid,p_role text,p_school_ids text[] default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare member_role text;
begin
 if not public.is_super_admin() then raise exception 'super admin required'; end if;
 if p_role not in ('super_admin','school_admin','evaluator','viewer','pending') then raise exception 'invalid role'; end if;
 if p_user_id='33906f41-3eaf-45ca-a416-65c15992933c'::uuid and p_role<>'super_admin' then
  raise exception 'the primary super admin cannot be demoted';
 end if;
 update public.profiles set role=p_role where id=p_user_id;
 if not found then raise exception 'user profile not found'; end if;
 delete from public.school_members where user_id=p_user_id;
 if p_role in ('school_admin','evaluator') then
  member_role:=case when p_role='school_admin' then 'admin' else 'evaluator' end;
  insert into public.school_members(school_id,user_id,role)
  select distinct selected.school_id,p_user_id,member_role
  from unnest(coalesce(p_school_ids,'{}')) as selected(school_id)
  where exists(select 1 from public.schools s where s.id=selected.school_id and not s.is_deleted);
 end if;
end; $$;

create or replace function public.reorder_student_numbers(p_classroom_id text,p_assignments jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; target_school text;
begin
 select school_id into target_school from public.classrooms where id=p_classroom_id;
 if target_school is null or not public.can_edit_school(target_school) then raise exception 'permission denied'; end if;
 if jsonb_typeof(p_assignments)<>'array' then raise exception 'assignments must be an array'; end if;
 for item in select * from jsonb_array_elements(p_assignments) loop
  update public.students set student_no=-100000-(item->>'no')::integer
  where id=item->>'id' and classroom_id=p_classroom_id;
 end loop;
 for item in select * from jsonb_array_elements(p_assignments) loop
  update public.students set student_no=(item->>'no')::integer
  where id=item->>'id' and classroom_id=p_classroom_id;
 end loop;
end; $$;

-- Lightweight dashboard totals. The web app uses this instead of downloading
-- every student and result row when the user signs in.
create or replace function public.school_dashboard_summaries()
returns table(school_id text,rooms bigint,students bigint,scored bigint,passed bigint,score_total numeric)
language sql stable security definer set search_path=public as $$
 with latest_sessions as (
  select distinct on (ts.classroom_id) ts.id,ts.classroom_id
  from public.test_sessions ts
  where ts.is_deleted=false
  order by ts.classroom_id,ts.created_at desc,ts.id desc
 )
 select s.id,
  count(distinct c.id)::bigint,
  count(distinct st.id) filter(where st.active=true)::bigint,
  count(tr.student_id) filter(where st.active=true and tr.absent=false and tr.is_special=false and tr.score is not null)::bigint,
  count(tr.student_id) filter(where st.active=true and tr.absent=false and tr.is_special=false and tr.score>=35)::bigint,
  coalesce(sum(tr.score) filter(where st.active=true and tr.absent=false and tr.score is not null),0)::numeric
 from public.schools s
 left join public.classrooms c on c.school_id=s.id and c.is_deleted=false
 left join public.students st on st.classroom_id=c.id
 left join latest_sessions ls on ls.classroom_id=c.id
 left join public.test_results tr on tr.session_id=ls.id and tr.student_id=st.id
 where s.is_deleted=false and public.can_access_school(s.id)
 group by s.id
$$;

create or replace function public.dashboard_insights(p_office_id text default null,p_limit integer default 20)
returns jsonb language sql stable security definer set search_path=public as $$
 with latest_sessions as (
  select distinct on (ts.classroom_id) ts.id,ts.classroom_id,ts.test_name,ts.test_date
  from public.test_sessions ts
  where ts.is_deleted=false
  order by ts.classroom_id,ts.created_at desc,ts.id desc
 ), base as (
  select s.id school_id,s.name school_name,c.id classroom_id,c.name classroom_name,
   st.id student_id,st.student_no,st.full_name,ls.id session_id,ls.test_name,
   tr.score,tr.time_value,coalesce(tr.absent,false) absent,tr.is_special,tr.updated_at
  from public.schools s
  join public.classrooms c on c.school_id=s.id and c.is_deleted=false
  join public.students st on st.classroom_id=c.id and st.active=true
  left join latest_sessions ls on ls.classroom_id=c.id
  left join public.test_results tr on tr.session_id=ls.id and tr.student_id=st.id
  where s.is_deleted=false and public.can_access_school(s.id)
   and (p_office_id is null or s.office_id=p_office_id or (p_office_id='unassigned' and s.office_id is null))
 ), room_stats as (
  select school_id,school_name,classroom_id,classroom_name,count(*) students,
   count(score) filter(where absent=false and is_special=false) scored,
   count(score) filter(where absent=false and is_special=false and score>=35) passed,
   round(coalesce(avg(score) filter(where absent=false and is_special=false),0),1) avg_score,
   round(coalesce(100.0*count(score) filter(where absent=false and is_special=false and score>=35)/nullif(count(score) filter(where absent=false and is_special=false),0),0),1) pass_percent
  from base group by school_id,school_name,classroom_id,classroom_name
 ), recent as (
  select s.id school_id,s.name school_name,c.id classroom_id,c.name classroom_name,
   ts.id session_id,ts.test_name,ts.test_date,count(tr.student_id) result_count,
   coalesce(max(tr.updated_at),ts.created_at) last_activity
  from public.schools s
  join public.classrooms c on c.school_id=s.id and c.is_deleted=false
  join public.test_sessions ts on ts.classroom_id=c.id and ts.is_deleted=false
  left join public.test_results tr on tr.session_id=ts.id
  where s.is_deleted=false and public.can_access_school(s.id)
   and (p_office_id is null or s.office_id=p_office_id or (p_office_id='unassigned' and s.office_id is null))
  group by s.id,s.name,c.id,c.name,ts.id,ts.test_name,ts.test_date,ts.created_at
 )
 select jsonb_build_object(
  'attention',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select school_id,school_name,classroom_id,classroom_name,student_id,student_no,full_name,session_id,score,time_value,
    case when absent then 'absent' when score is null then 'pending' else 'failed' end status
   from base where absent=true or score is null or score<35
   order by case when absent then 1 when score is not null then 2 else 3 end,score nulls last,school_name,classroom_name,student_no
   limit greatest(1,least(p_limit,100))
  ) x),'[]'::jsonb),
  'outstanding',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select school_id,school_name,classroom_id,classroom_name,student_id,student_no,full_name,session_id,score,time_value
   from base where absent=false and score>=35
   order by score desc,
    case when time_value~'^[0-9]+[:.][0-9]+$' then split_part(replace(time_value,'.',':'),':',1)::integer*60+split_part(replace(time_value,'.',':'),':',2)::integer end asc nulls last,
    school_name,classroom_name,student_no
   limit greatest(1,least(p_limit,100))
  ) x),'[]'::jsonb),
  'rooms_to_improve',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select * from room_stats where scored=0 or pass_percent<60 order by scored>0,pass_percent,school_name,classroom_name
   limit greatest(1,least(p_limit,100))
  ) x),'[]'::jsonb),
  'recent',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select * from recent order by last_activity desc
   limit greatest(1,least(p_limit,100))
  ) x),'[]'::jsonb)
 )
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.offices enable row level security;
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.test_sessions enable row level security;
alter table public.test_results enable row level security;
alter table public.inventory_items enable row level security;
alter table public.office_inventory enable row level security;
alter table public.school_inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.teacher_requests enable row level security;
alter table public.onsite_evaluations enable row level security;

-- Drop old policies to avoid duplicates/conflicts
drop policy if exists "profile own read" on public.profiles;
drop policy if exists "profile own update" on public.profiles;
drop policy if exists "profile_own_all" on public.profiles;
drop policy if exists "school member read" on public.schools;
drop policy if exists "school create" on public.schools;
drop policy if exists "school admin update" on public.schools;
drop policy if exists "school_select" on public.schools;
drop policy if exists "school_insert" on public.schools;
drop policy if exists "school_update" on public.schools;
drop policy if exists "member read" on public.school_members;
drop policy if exists "member admin insert" on public.school_members;
drop policy if exists "member admin update" on public.school_members;
drop policy if exists "member_all" on public.school_members;
drop policy if exists "class member all" on public.classrooms;
drop policy if exists "class_all" on public.classrooms;
drop policy if exists "student member all" on public.students;
drop policy if exists "student_all" on public.students;
drop policy if exists "session member all" on public.test_sessions;
drop policy if exists "session_all" on public.test_sessions;
drop policy if exists "result member all" on public.test_results;
drop policy if exists "result_all" on public.test_results;
drop policy if exists "inventory_items_select" on public.inventory_items;
drop policy if exists "inventory_items_write" on public.inventory_items;
drop policy if exists "office_inventory_select" on public.office_inventory;
drop policy if exists "office_inventory_write" on public.office_inventory;
drop policy if exists "school_inventory_select" on public.school_inventory;
drop policy if exists "school_inventory_write" on public.school_inventory;
drop policy if exists "stock_movements_select" on public.stock_movements;
drop policy if exists "stock_movements_insert" on public.stock_movements;
drop policy if exists "profile_select" on public.profiles;
drop policy if exists "profile_admin_update" on public.profiles;
drop policy if exists "office_select" on public.offices;
drop policy if exists "office_insert" on public.offices;
drop policy if exists "office_update" on public.offices;
drop policy if exists "school_delete" on public.schools;
drop policy if exists "member_select" on public.school_members;
drop policy if exists "member_insert" on public.school_members;
drop policy if exists "member_update" on public.school_members;
drop policy if exists "member_delete" on public.school_members;
drop policy if exists "class_select" on public.classrooms;
drop policy if exists "class_write" on public.classrooms;
drop policy if exists "student_select" on public.students;
drop policy if exists "student_write" on public.students;
drop policy if exists "session_select" on public.test_sessions;
drop policy if exists "session_write" on public.test_sessions;
drop policy if exists "result_select" on public.test_results;
drop policy if exists "result_write" on public.test_results;
drop policy if exists "teacher_requests_insert" on public.teacher_requests;
drop policy if exists "teacher_requests_select" on public.teacher_requests;
drop policy if exists "teacher_requests_update" on public.teacher_requests;
drop policy if exists "teacher_requests_delete" on public.teacher_requests;
drop policy if exists "onsite_evaluations_insert" on public.onsite_evaluations;
drop policy if exists "onsite_evaluations_select" on public.onsite_evaluations;
drop policy if exists "onsite_evaluations_update" on public.onsite_evaluations;
drop policy if exists "onsite_evaluations_delete" on public.onsite_evaluations;

-- Profiles: active users can read profiles to see who updated scores; only the super admin can list and assign access.
create policy "profile_select" on public.profiles for select using(true);
create policy "profile_admin_update" on public.profiles for update using(public.is_super_admin());

create policy "office_select" on public.offices for select using(exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));
create policy "office_insert" on public.offices for insert with check(created_by=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and role in ('super_admin','school_admin')));
create policy "office_update" on public.offices for update using(public.is_super_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin')) with check(public.is_super_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin'));

create policy "school_select" on public.schools for select using (
  public.can_access_school(id)
);
create policy "school_insert" on public.schools for insert with check(created_by=auth.uid() and (public.is_super_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin')));
create policy "school_update" on public.schools for update using(public.can_edit_school(id)) with check(public.can_edit_school(id));
create policy "school_delete" on public.schools for delete using(public.can_admin_school(id));

create policy "member_select" on public.school_members for select using(user_id=auth.uid() or public.is_super_admin() or public.can_admin_school(school_id));
create policy "member_insert" on public.school_members for insert with check(public.is_super_admin() or public.can_admin_school(school_id));
create policy "member_update" on public.school_members for update using(public.is_super_admin() or public.can_admin_school(school_id)) with check(public.is_super_admin() or public.can_admin_school(school_id));
create policy "member_delete" on public.school_members for delete using(public.is_super_admin() or public.can_admin_school(school_id));

create policy "class_select" on public.classrooms for select using(public.can_access_school(school_id));
create policy "class_write" on public.classrooms for all using(public.can_edit_school(school_id)) with check(public.can_edit_school(school_id));
create policy "student_select" on public.students for select using(public.can_access_school((select c.school_id from public.classrooms c where c.id=public.students.classroom_id)));
create policy "student_write" on public.students for all using(public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.students.classroom_id))) with check(public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.students.classroom_id)));
create policy "session_select" on public.test_sessions for select using(public.can_access_school((select c.school_id from public.classrooms c where c.id=public.test_sessions.classroom_id)));
create policy "session_write" on public.test_sessions for all using(public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.test_sessions.classroom_id))) with check(public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.test_sessions.classroom_id)));
create policy "result_select" on public.test_results for select using(public.can_access_school((select c.school_id from public.test_sessions ts join public.classrooms c on c.id=ts.classroom_id where ts.id=public.test_results.session_id)));
create policy "result_write" on public.test_results for all using(public.can_edit_school((select c.school_id from public.test_sessions ts join public.classrooms c on c.id=ts.classroom_id where ts.id=public.test_results.session_id))) with check(public.can_edit_school((select c.school_id from public.test_sessions ts join public.classrooms c on c.id=ts.classroom_id where ts.id=public.test_results.session_id)));

create policy "inventory_items_select" on public.inventory_items for select using(exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));
create policy "inventory_items_write" on public.inventory_items for all using(public.is_super_admin()) with check(public.is_super_admin());
create policy "office_inventory_select" on public.office_inventory for select using(exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));
create policy "office_inventory_write" on public.office_inventory for all using(public.is_super_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin')) with check(public.is_super_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin'));
create policy "school_inventory_select" on public.school_inventory for select using(public.can_access_school(school_id));
create policy "school_inventory_write" on public.school_inventory for all using(public.can_edit_school(school_id)) with check(public.can_edit_school(school_id));
create policy "stock_movements_select" on public.stock_movements for select using(exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));

create policy "teacher_requests_insert" on public.teacher_requests for insert with check (true);
create policy "teacher_requests_select" on public.teacher_requests for select using (public.can_access_school(school_id));
create policy "teacher_requests_update" on public.teacher_requests for update using (public.can_edit_school(school_id)) with check (public.can_edit_school(school_id));
create policy "teacher_requests_delete" on public.teacher_requests for delete using (public.can_admin_school(school_id));

create policy "onsite_evaluations_insert" on public.onsite_evaluations for insert with check (true);
create policy "onsite_evaluations_select" on public.onsite_evaluations for select using (public.can_access_school(school_id));
create policy "onsite_evaluations_update" on public.onsite_evaluations for update using (public.can_edit_school(school_id)) with check (public.can_edit_school(school_id));
create policy "onsite_evaluations_delete" on public.onsite_evaluations for delete using (public.can_admin_school(school_id));

-- Permissions
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke insert,update,delete on public.stock_movements from authenticated;
grant execute on function public.admin_set_user_access(uuid,text,text[]) to authenticated;
grant execute on function public.reorder_student_numbers(text,jsonb) to authenticated;
grant execute on function public.school_dashboard_summaries() to authenticated;
grant execute on function public.dashboard_insights(text,integer) to authenticated;
grant execute on function public.apply_stock_movement(text,text,integer,text,text,text,text) to authenticated;

-- Refresh cache
NOTIFY pgrst, 'reload schema';

-- Enable Realtime
drop publication if exists supabase_realtime;
create publication supabase_realtime;
alter publication supabase_realtime add table public.test_results;

-- Public Search RPC
drop function if exists public.search_student_scores;
create or replace function public.search_student_scores(search_name text)
returns table (
  school_name text,
  academic_year text,
  term text,
  classroom_name text,
  student_name text,
  student_no integer,
  test_name text,
  robot_type text,
  exam_set text,
  score numeric,
  time_value text,
  absent boolean,
  rank integer,
  total_students integer
)
language plpgsql
security definer
as $$
begin
  if length(trim(search_name)) < 4 then
    return;
  end if;

  return query
  with matched_students as (
    select st.id, st.classroom_id, st.full_name, st.student_no
    from public.students st
    where st.full_name ilike '%' || trim(search_name) || '%'
    limit 50
  ),
  session_ranks as (
    select 
      tr.session_id,
      tr.student_id,
      rank() over (
        partition by tr.session_id 
        order by tr.score desc nulls last, tr.time_value asc nulls last
      ) as rnk,
      count(tr.student_id) over (partition by tr.session_id) as total_st
    from public.test_results tr
    where tr.session_id in (
      select ts.id from public.test_sessions ts
      where ts.classroom_id in (select ms.classroom_id from matched_students ms)
    )
    and tr.absent = false
    and tr.score is not null
  )
  select 
    s.name as school_name,
    s.academic_year as academic_year,
    s.term as term,
    c.name as classroom_name,
    ms.full_name as student_name,
    ms.student_no as student_no,
    ts.test_name as test_name,
    ts.robot_type as robot_type,
    ts.exam_set as exam_set,
    tr.score as score,
    tr.time_value as time_value,
    tr.absent as absent,
    sr.rnk::integer as rank,
    sr.total_st::integer as total_students
  from matched_students ms
  join public.classrooms c on c.id = ms.classroom_id
  join public.schools s on s.id = c.school_id
  join public.test_sessions ts on ts.classroom_id = ms.classroom_id
  left join public.test_results tr on tr.session_id = ts.id and tr.student_id = ms.id
  left join session_ranks sr on sr.session_id = ts.id and sr.student_id = ms.id
  where s.is_deleted = false
  order by s.academic_year desc, s.term desc, s.name, c.name, ms.full_name, ts.created_at asc;
end;
$$;
grant execute on function public.search_student_scores(text) to public;
grant execute on function public.search_student_scores(text) to anon;
grant execute on function public.search_student_scores(text) to authenticated;

-- Public competition leaderboard for /exam_test
drop function if exists public.get_exam_test_leaderboard;
create or replace function public.get_exam_test_leaderboard()
returns table (
  school_id text,
  classroom_id text,
  session_id text,
  school_name text,
  academic_year text,
  term text,
  classroom_name text,
  student_id text,
  student_no integer,
  student_name text,
  test_name text,
  test_date date,
  robot_type text,
  exam_set text,
  score numeric,
  time_value text,
  time_seconds integer,
  rank integer,
  total_scored integer
)
language sql
stable
security definer
set search_path=public
as $$
  with scored as (
    select
      s.id as school_id,
      c.id as classroom_id,
      ts.id as session_id,
      s.name as school_name,
      s.academic_year,
      s.term,
      c.name as classroom_name,
      st.id as student_id,
      st.student_no,
      st.full_name as student_name,
      ts.test_name,
      ts.test_date,
      ts.robot_type,
      ts.exam_set,
      tr.score,
      tr.time_value,
      case
        when tr.time_value ~ '^[0-9]+[:.][0-9]+$'
          then split_part(replace(tr.time_value,'.',':'),':',1)::integer * 60
            + split_part(replace(tr.time_value,'.',':'),':',2)::integer
        when tr.time_value ~ '^[0-9]+$'
          then tr.time_value::integer
        else null
      end as time_seconds
    from public.test_results tr
    join public.test_sessions ts on ts.id = tr.session_id
    join public.students st on st.id = tr.student_id
    join public.classrooms c on c.id = st.classroom_id and c.id = ts.classroom_id
    join public.schools s on s.id = c.school_id
    where s.is_deleted = false
      and c.is_deleted = false
      and ts.is_deleted = false
      and st.active = true
      and tr.absent = false
      and coalesce(tr.is_special,false) = false
      and tr.score is not null
  )
  select
    scored.school_id,
    scored.classroom_id,
    scored.session_id,
    scored.school_name,
    scored.academic_year,
    scored.term,
    scored.classroom_name,
    scored.student_id,
    scored.student_no,
    scored.student_name,
    scored.test_name,
    scored.test_date,
    scored.robot_type,
    scored.exam_set,
    scored.score,
    scored.time_value,
    scored.time_seconds,
    row_number() over (
      partition by scored.session_id
      order by scored.score desc, scored.time_seconds asc nulls last, scored.student_no asc, scored.student_name asc
    )::integer as rank,
    count(*) over (partition by scored.session_id)::integer as total_scored
  from scored
  order by scored.school_name, scored.classroom_name, scored.test_date desc nulls last, scored.test_name, rank;
$$;
grant execute on function public.get_exam_test_leaderboard() to public;
grant execute on function public.get_exam_test_leaderboard() to anon;
grant execute on function public.get_exam_test_leaderboard() to authenticated;

-- Classroom Locks for Concurrency Control
create table if not exists public.classroom_locks (
    classroom_id text primary key references public.classrooms(id) on delete cascade,
    locked_by uuid references auth.users(id) on delete cascade,
    locked_by_name text,
    locked_at timestamptz not null default now()
);

alter table public.classroom_locks enable row level security;
drop policy if exists "classroom_locks_all" on public.classroom_locks;
revoke all on public.classroom_locks from public,anon,authenticated;

create or replace function public.acquire_classroom_lock(p_classroom_id text,p_locked_by_name text default null)
returns table(success boolean,locked_by_name text)
language plpgsql security definer set search_path=public as $$
declare v_lock public.classroom_locks%rowtype; v_name text:=coalesce(nullif(btrim(p_locked_by_name),''),'แอดมิน');
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.classrooms c where c.id=p_classroom_id and public.can_edit_school(c.school_id)) then raise exception 'Not permitted to edit this classroom' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(p_classroom_id));
 delete from public.classroom_locks where classroom_id=p_classroom_id and locked_at<now()-interval '5 minutes';
 select * into v_lock from public.classroom_locks where classroom_id=p_classroom_id for update;
 if found then
  if v_lock.locked_by=auth.uid() then
   update public.classroom_locks set locked_at=now(),locked_by_name=v_name where classroom_id=p_classroom_id;
   return query select true,v_name;
  end if;
  return query select false,coalesce(v_lock.locked_by_name,'แอดมินท่านอื่น');
  return;
 end if;
 insert into public.classroom_locks(classroom_id,locked_by,locked_by_name) values(p_classroom_id,auth.uid(),v_name);
 return query select true,v_name;
end; $$;

create or replace function public.verify_classroom_lock(p_classroom_id text)
returns table(has_lock boolean,locked_by_name text)
language plpgsql security definer set search_path=public as $$
declare v_lock public.classroom_locks%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.classrooms c where c.id=p_classroom_id and public.can_edit_school(c.school_id)) then raise exception 'Not permitted to edit this classroom' using errcode='42501'; end if;
 select * into v_lock from public.classroom_locks where classroom_id=p_classroom_id and locked_at>=now()-interval '5 minutes';
 if found and v_lock.locked_by=auth.uid() then return query select true,null::text; return; end if;
 return query select false,coalesce(v_lock.locked_by_name,'ไม่มีสิทธิ์ล็อกห้องนี้');
end; $$;

create or replace function public.keep_classroom_lock_alive(p_classroom_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.classrooms c where c.id=p_classroom_id and public.can_edit_school(c.school_id)) then raise exception 'Not permitted to edit this classroom' using errcode='42501'; end if;
 update public.classroom_locks set locked_at=now() where classroom_id=p_classroom_id and locked_by=auth.uid() and locked_at>=now()-interval '5 minutes';
 return found;
end; $$;

create or replace function public.release_classroom_lock(p_classroom_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return; end if;
 delete from public.classroom_locks where classroom_id=p_classroom_id and locked_by=auth.uid();
end; $$;

revoke all on function public.acquire_classroom_lock(text,text) from public;
revoke all on function public.verify_classroom_lock(text) from public;
revoke all on function public.keep_classroom_lock_alive(text) from public;
revoke all on function public.release_classroom_lock(text) from public;
grant execute on function public.acquire_classroom_lock(text,text) to authenticated;
grant execute on function public.verify_classroom_lock(text) to authenticated;
grant execute on function public.keep_classroom_lock_alive(text) to authenticated;
grant execute on function public.release_classroom_lock(text) to authenticated;

-- Score-entry status is aggregated in PostgreSQL.  It deliberately exposes
-- counts and timestamps only; no school, student, or result data is modified.
drop function if exists public.score_entry_status_summaries();
drop function if exists public.score_entry_status_summaries(integer);
drop function if exists public.score_entry_status_rooms(text);
drop function if exists public.score_entry_status_rooms(text,integer);

create or replace function public.score_entry_status_test_rounds()
returns table(test_number integer)
language sql stable security definer set search_path=public as $$
 select distinct nullif(substring(coalesce(ts.test_name,'') from '([0-9]+)'),'')::integer
 from public.test_sessions ts
 join public.classrooms c on c.id=ts.classroom_id and c.is_deleted=false
 join public.schools s on s.id=c.school_id and s.is_deleted=false
 where ts.is_deleted=false and public.can_access_school(s.id)
   and nullif(substring(coalesce(ts.test_name,'') from '([0-9]+)'),'') is not null
 order by 1
$$;

create or replace function public.score_entry_status_summaries(p_test_number integer default null)
returns table(school_id text,school_name text,academic_year text,term text,office_id text,room_count bigint,rooms_with_scores bigint,student_count bigint,scored_student_count bigint,absent_student_count bigint,pending_student_count bigint,rooms_without_session bigint,rooms_with_suggestions bigint,rooms_without_suggestions bigint,rooms_exempt_from_suggestions bigint,updated_at timestamptz)
language sql stable security definer set search_path=public as $$
 with selected_sessions as (
  select ts.id,ts.classroom_id,ts.test_name,ts.test_date,ts.summary,ts.created_at
  from public.test_sessions ts
  where ts.is_deleted=false
   and (p_test_number is null or nullif(substring(coalesce(ts.test_name,'') from '([0-9]+)'),'')::integer=p_test_number)
 ), session_rooms as (
  select classroom_id,true has_test_session from selected_sessions group by classroom_id
 ), feedback_statuses as (
  select classroom_id,
   bool_and(btrim(coalesce(summary,''))<>'') has_suggestions
  from selected_sessions
  group by classroom_id
 ), student_statuses as (
  select ss.classroom_id,tr.student_id,
   bool_or(tr.score is not null) has_score,
   bool_or(tr.absent) has_absence,
   max(tr.updated_at) updated_at
  from selected_sessions ss
  join public.test_results tr on tr.session_id=ss.id
  group by ss.classroom_id,tr.student_id
  ), room_stats_base as (
  select c.id classroom_id,c.school_id,
   coalesce(sr.has_test_session,false) has_test_session,
   count(st.id) filter(where st.active=true or student_statuses.student_id is not null)::bigint student_count,
   count(st.id) filter(where (st.active=true or student_statuses.student_id is not null) and student_statuses.has_score)::bigint scored_student_count,
   count(st.id) filter(where (st.active=true or student_statuses.student_id is not null) and not coalesce(student_statuses.has_score,false) and student_statuses.has_absence)::bigint absent_student_count,
   count(st.id) filter(where (st.active=true or student_statuses.student_id is not null) and coalesce(sr.has_test_session,false) and not coalesce(student_statuses.has_score,false) and not coalesce(student_statuses.has_absence,false))::bigint pending_student_count,
   coalesce(fs.has_suggestions,false) has_suggestions,
   max(student_statuses.updated_at) updated_at
  from public.classrooms c
  left join public.students st on st.classroom_id=c.id
  left join session_rooms sr on sr.classroom_id=c.id
  left join feedback_statuses fs on fs.classroom_id=c.id
  left join student_statuses on student_statuses.classroom_id=c.id and student_statuses.student_id=st.id
  where c.is_deleted=false
  group by c.id,c.school_id,sr.has_test_session,fs.has_suggestions
  ), room_stats as (
   select rb.*,
    (rb.has_test_session and rb.student_count>0 and rb.absent_student_count<rb.student_count) suggestions_required
   from room_stats_base rb
  )
 select s.id,s.name,s.academic_year,s.term,s.office_id,
  count(rs.classroom_id)::bigint,
  count(rs.classroom_id) filter(where rs.scored_student_count>0)::bigint,
  coalesce(sum(rs.student_count),0)::bigint,
  coalesce(sum(rs.scored_student_count),0)::bigint,
  coalesce(sum(rs.absent_student_count),0)::bigint,
  coalesce(sum(rs.pending_student_count),0)::bigint,
   count(rs.classroom_id) filter(where not rs.has_test_session)::bigint,
   count(rs.classroom_id) filter(where rs.has_test_session and rs.suggestions_required and rs.has_suggestions)::bigint,
   count(rs.classroom_id) filter(where rs.has_test_session and rs.suggestions_required and not rs.has_suggestions)::bigint,
   count(rs.classroom_id) filter(where rs.has_test_session and not rs.suggestions_required)::bigint,
  max(rs.updated_at)
 from public.schools s
 left join room_stats rs on rs.school_id=s.id
 where s.is_deleted=false and public.can_access_school(s.id)
 group by s.id,s.name,s.academic_year,s.term,s.office_id
 order by s.name
$$;

create or replace function public.score_entry_status_rooms(p_school_id text,p_test_number integer default null)
returns table(classroom_id text,classroom_name text,student_count bigint,scored_student_count bigint,absent_student_count bigint,pending_student_count bigint,has_scores boolean,has_test_session boolean,has_suggestions boolean,suggestions_required boolean,session_id text,latest_test text,latest_test_date date,updated_at timestamptz)
language sql stable security definer set search_path=public as $$
 with selected_sessions as (
  select ts.id,ts.classroom_id,ts.test_name,ts.test_date,ts.summary,ts.created_at
  from public.test_sessions ts
  where ts.is_deleted=false
   and (p_test_number is null or nullif(substring(coalesce(ts.test_name,'') from '([0-9]+)'),'')::integer=p_test_number)
 ), session_rooms as (
  select classroom_id,true has_test_session from selected_sessions group by classroom_id
 ), feedback_statuses as (
  select classroom_id,
   bool_and(btrim(coalesce(summary,''))<>'') has_suggestions
  from selected_sessions
  group by classroom_id
 ), student_statuses as (
  select ss.classroom_id,tr.student_id,
   bool_or(tr.score is not null) has_score,
   bool_or(tr.absent) has_absence,
   max(tr.updated_at) updated_at
  from selected_sessions ss
  join public.test_results tr on tr.session_id=ss.id
  group by ss.classroom_id,tr.student_id
  ), latest_sessions as (
   select distinct on (classroom_id) classroom_id,id session_id,test_name,test_date
   from selected_sessions
   order by classroom_id,created_at desc,id desc
  ), room_stats_base as (
   select c.id classroom_id,c.school_id,
    coalesce(sr.has_test_session,false) has_test_session,
    count(st.id) filter(where st.active=true or student_statuses.student_id is not null)::bigint student_count,
    count(st.id) filter(where (st.active=true or student_statuses.student_id is not null) and student_statuses.has_score)::bigint scored_student_count,
    count(st.id) filter(where (st.active=true or student_statuses.student_id is not null) and not coalesce(student_statuses.has_score,false) and student_statuses.has_absence)::bigint absent_student_count,
    count(st.id) filter(where (st.active=true or student_statuses.student_id is not null) and coalesce(sr.has_test_session,false) and not coalesce(student_statuses.has_score,false) and not coalesce(student_statuses.has_absence,false))::bigint pending_student_count,
    coalesce(fs.has_suggestions,false) has_suggestions,
    max(student_statuses.updated_at) updated_at
   from public.classrooms c
   left join public.students st on st.classroom_id=c.id
   left join session_rooms sr on sr.classroom_id=c.id
   left join feedback_statuses fs on fs.classroom_id=c.id
   left join student_statuses on student_statuses.classroom_id=c.id and student_statuses.student_id=st.id
   where c.is_deleted=false
   group by c.id,c.school_id,sr.has_test_session,fs.has_suggestions
  ), room_stats as (
   select rb.*,
    (rb.has_test_session and rb.student_count>0 and rb.absent_student_count<rb.student_count) suggestions_required
   from room_stats_base rb
  )
  select c.id,c.name,
   coalesce(rs.student_count,0),
   coalesce(rs.scored_student_count,0),
   coalesce(rs.absent_student_count,0),
   coalesce(rs.pending_student_count,0),
   coalesce(rs.scored_student_count,0)>0,
   coalesce(rs.has_test_session,false),
   coalesce(rs.has_suggestions,false),
   coalesce(rs.suggestions_required,false),
   ls.session_id,ls.test_name,ls.test_date,rs.updated_at
  from public.classrooms c
  join public.schools s on s.id=c.school_id
  left join room_stats rs on rs.classroom_id=c.id
  left join latest_sessions ls on ls.classroom_id=c.id
  where c.school_id=p_school_id and c.is_deleted=false and s.is_deleted=false and public.can_access_school(s.id)
  order by c.name
$$;

revoke all on function public.score_entry_status_test_rounds() from public;
revoke all on function public.score_entry_status_summaries(integer) from public;
revoke all on function public.score_entry_status_rooms(text,integer) from public;
grant execute on function public.score_entry_status_test_rounds() to authenticated;
grant execute on function public.score_entry_status_summaries(integer) to authenticated;
grant execute on function public.score_entry_status_rooms(text,integer) to authenticated;
NOTIFY pgrst, 'reload schema';
