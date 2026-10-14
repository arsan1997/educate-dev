-- Internal competition data is intentionally isolated from assessment results.
-- Apply this migration to the TEST project first: bumbeczlxcgmbnnsjxvi

create table if not exists public.competition_sessions (
  id text primary key,
  classroom_id text not null references public.classrooms(id) on delete cascade,
  competition_name text not null,
  competition_date date,
  robot_type text,
  exam_set text,
  created_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists competition_sessions_classroom_idx
  on public.competition_sessions(classroom_id,created_at);

create table if not exists public.competition_results (
  session_id text not null references public.competition_sessions(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  score numeric check(score between 0 and 50),
  time_value text,
  absent boolean not null default false,
  is_special boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(session_id,student_id)
);

alter table public.competition_sessions enable row level security;
alter table public.competition_results enable row level security;

drop policy if exists "competition_session_select" on public.competition_sessions;
drop policy if exists "competition_session_write" on public.competition_sessions;
drop policy if exists "competition_result_select" on public.competition_results;
drop policy if exists "competition_result_write" on public.competition_results;

create policy "competition_session_select" on public.competition_sessions
for select using (
  public.can_access_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
);

create policy "competition_session_write" on public.competition_sessions
for all using (
  public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
) with check (
  public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
);

create policy "competition_result_select" on public.competition_results
for select using (
  public.can_access_school((
    select c.school_id
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    where cs.id=public.competition_results.session_id
  ))
);

create policy "competition_result_write" on public.competition_results
for all using (
  public.can_edit_school((
    select c.school_id
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    where cs.id=public.competition_results.session_id
  ))
) with check (
  public.can_edit_school((
    select c.school_id
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    where cs.id=public.competition_results.session_id
  ))
);

grant select,insert,update,delete on public.competition_sessions to authenticated;
grant select,insert,update,delete on public.competition_results to authenticated;

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
      cs.id as session_id,
      s.name as school_name,
      s.academic_year,
      s.term,
      c.name as classroom_name,
      st.id as student_id,
      st.student_no,
      st.full_name as student_name,
      cs.competition_name as test_name,
      cs.competition_date as test_date,
      cs.robot_type,
      cs.exam_set,
      cr.score,
      cr.time_value,
      case
        when cr.time_value ~ '^[0-9]+[:.][0-9]+$'
          then split_part(replace(cr.time_value,'.',':'),':',1)::integer * 60
            + split_part(replace(cr.time_value,'.',':'),':',2)::integer
        when cr.time_value ~ '^[0-9]+$' then cr.time_value::integer
        else null
      end as time_seconds
    from public.competition_results cr
    join public.competition_sessions cs on cs.id=cr.session_id
    join public.students st on st.id=cr.student_id
    join public.classrooms c on c.id=st.classroom_id and c.id=cs.classroom_id
    join public.schools s on s.id=c.school_id
    where s.is_deleted=false
      and c.is_deleted=false
      and cs.is_deleted=false
      and st.active=true
      and cr.absent=false
      and coalesce(cr.is_special,false)=false
      and cr.score is not null
  )
  select
    scored.school_id,scored.classroom_id,scored.session_id,
    scored.school_name,scored.academic_year,scored.term,scored.classroom_name,
    scored.student_id,scored.student_no,scored.student_name,
    scored.test_name,scored.test_date,scored.robot_type,scored.exam_set,
    scored.score,scored.time_value,scored.time_seconds,
    row_number() over (
      partition by scored.session_id
      order by scored.score desc,scored.time_seconds asc nulls last,scored.student_no asc,scored.student_name asc
    )::integer as rank,
    count(*) over (partition by scored.session_id)::integer as total_scored
  from scored
  order by scored.school_name,scored.classroom_name,scored.test_date desc nulls last,scored.test_name,rank;
$$;

grant execute on function public.get_exam_test_leaderboard() to public;
grant execute on function public.get_exam_test_leaderboard() to anon;
grant execute on function public.get_exam_test_leaderboard() to authenticated;

notify pgrst, 'reload schema';
