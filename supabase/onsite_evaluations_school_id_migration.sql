-- Backfill the school relation for legacy onsite evaluations once.
-- Run this after schema.sql has been applied, then verify the result below.
begin;

update public.onsite_evaluations as evaluation
set school_id = classroom.school_id,
    updated_at = now()
from public.classrooms as classroom
where evaluation.school_id is null
  and evaluation.classroom_id = classroom.id;

do $$
begin
  if exists (
    select 1
    from public.onsite_evaluations
    where school_id is null
  ) then
    raise exception 'onsite_evaluations still contains rows with null school_id';
  end if;
end $$;

alter table public.onsite_evaluations
  alter column school_id set not null;

commit;

-- Expected result after the migration: 0
select count(*) as remaining_null_school_ids
from public.onsite_evaluations
where school_id is null;
