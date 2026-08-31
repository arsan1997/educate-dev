-- Apply in Supabase Dashboard > SQL Editor immediately before deploying the web app.
-- This migration changes no student scores or test-result rows.

begin;

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
notify pgrst, 'reload schema';

commit;
