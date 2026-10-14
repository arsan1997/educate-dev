-- Prevent two users from editing the same internal competition at once.
-- Locks are scoped to a competition session, so different rooms and different
-- competitions in the same room remain independently editable.

create table if not exists public.competition_session_locks (
  session_id text primary key references public.competition_sessions(id) on delete cascade,
  locked_by uuid not null references auth.users(id) on delete cascade,
  locked_by_name text,
  locked_at timestamptz not null default now()
);

alter table public.competition_session_locks enable row level security;
revoke all on public.competition_session_locks from public,anon,authenticated;

create or replace function public.acquire_competition_session_lock(
  p_session_id text,
  p_locked_by_name text default null
)
returns table(success boolean,locked_by_name text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_lock public.competition_session_locks%rowtype;
  v_name text:=coalesce(nullif(btrim(p_locked_by_name),''),'แอดมิน');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not exists(
    select 1
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    where cs.id=p_session_id
      and cs.is_deleted=false
      and public.can_edit_school(c.school_id)
  ) then
    raise exception 'Not permitted to edit this competition' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('competition:'||p_session_id));
  delete from public.competition_session_locks
  where session_id=p_session_id and locked_at<now()-interval '5 minutes';

  select * into v_lock
  from public.competition_session_locks
  where session_id=p_session_id
  for update;

  if found then
    if v_lock.locked_by=auth.uid() then
      update public.competition_session_locks
      set locked_at=now(),locked_by_name=v_name
      where session_id=p_session_id;
      return query select true,v_name;
      return;
    end if;
    return query select false,coalesce(v_lock.locked_by_name,'แอดมินท่านอื่น');
    return;
  end if;

  insert into public.competition_session_locks(session_id,locked_by,locked_by_name)
  values(p_session_id,auth.uid(),v_name);
  return query select true,v_name;
end;
$$;

create or replace function public.verify_competition_session_lock(p_session_id text)
returns table(has_lock boolean,locked_by_name text)
language plpgsql
security definer
set search_path=public
as $$
declare v_lock public.competition_session_locks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not exists(
    select 1
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    where cs.id=p_session_id and public.can_edit_school(c.school_id)
  ) then
    raise exception 'Not permitted to edit this competition' using errcode='42501';
  end if;

  select * into v_lock
  from public.competition_session_locks
  where session_id=p_session_id and locked_at>=now()-interval '5 minutes';

  if found and v_lock.locked_by=auth.uid() then
    return query select true,null::text;
    return;
  end if;
  return query select false,coalesce(v_lock.locked_by_name,'ไม่มีสิทธิ์ล็อกรายการแข่งขันนี้');
end;
$$;

create or replace function public.keep_competition_session_lock_alive(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  update public.competition_session_locks
  set locked_at=now()
  where session_id=p_session_id
    and locked_by=auth.uid()
    and locked_at>=now()-interval '5 minutes';
  return found;
end;
$$;

create or replace function public.release_competition_session_lock(p_session_id text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.competition_session_locks
  where session_id=p_session_id and locked_by=auth.uid();
end;
$$;

revoke all on function public.acquire_competition_session_lock(text,text) from public;
revoke all on function public.verify_competition_session_lock(text) from public;
revoke all on function public.keep_competition_session_lock_alive(text) from public;
revoke all on function public.release_competition_session_lock(text) from public;
grant execute on function public.acquire_competition_session_lock(text,text) to authenticated;
grant execute on function public.verify_competition_session_lock(text) to authenticated;
grant execute on function public.keep_competition_session_lock_alive(text) to authenticated;
grant execute on function public.release_competition_session_lock(text) to authenticated;

-- Creating a new competition is allowed before its lock exists. Updating an
-- existing competition or writing results requires an active lock owned by the
-- current user, preventing a stale browser from overwriting the active editor.
drop policy if exists "competition_session_write" on public.competition_sessions;
drop policy if exists "competition_session_insert" on public.competition_sessions;
drop policy if exists "competition_session_update" on public.competition_sessions;
drop policy if exists "competition_session_delete" on public.competition_sessions;

create policy "competition_session_insert" on public.competition_sessions
for insert with check (
  public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
);

create policy "competition_session_update" on public.competition_sessions
for update using (
  public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
  and exists(
    select 1 from public.competition_session_locks lock
    where lock.session_id=public.competition_sessions.id
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
) with check (
  public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
  and exists(
    select 1 from public.competition_session_locks lock
    where lock.session_id=public.competition_sessions.id
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
);

create policy "competition_session_delete" on public.competition_sessions
for delete using (
  public.can_edit_school((select c.school_id from public.classrooms c where c.id=public.competition_sessions.classroom_id))
  and exists(
    select 1 from public.competition_session_locks lock
    where lock.session_id=public.competition_sessions.id
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
);

drop policy if exists "competition_result_write" on public.competition_results;
drop policy if exists "competition_results_insert" on public.competition_results;
drop policy if exists "competition_results_update" on public.competition_results;
drop policy if exists "competition_results_delete" on public.competition_results;

create policy "competition_results_insert" on public.competition_results
for insert with check (
  exists(
    select 1
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    join public.competition_session_locks lock on lock.session_id=cs.id
    where cs.id=public.competition_results.session_id
      and public.can_edit_school(c.school_id)
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
);

create policy "competition_results_update" on public.competition_results
for update using (
  exists(
    select 1
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    join public.competition_session_locks lock on lock.session_id=cs.id
    where cs.id=public.competition_results.session_id
      and public.can_edit_school(c.school_id)
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
) with check (
  exists(
    select 1
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    join public.competition_session_locks lock on lock.session_id=cs.id
    where cs.id=public.competition_results.session_id
      and public.can_edit_school(c.school_id)
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
);

create policy "competition_results_delete" on public.competition_results
for delete using (
  exists(
    select 1
    from public.competition_sessions cs
    join public.classrooms c on c.id=cs.classroom_id
    join public.competition_session_locks lock on lock.session_id=cs.id
    where cs.id=public.competition_results.session_id
      and public.can_edit_school(c.school_id)
      and lock.locked_by=auth.uid()
      and lock.locked_at>=now()-interval '5 minutes'
  )
);

notify pgrst, 'reload schema';
