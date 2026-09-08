-- Run once in Supabase Dashboard > SQL Editor before deploying the matching app build.
-- Adds recoverable-delete audit metadata without changing or deleting existing data.

begin;

alter table public.schools
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.classrooms
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.test_sessions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.onsite_evaluations
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_soft_delete_audit()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.is_deleted is true and old.is_deleted is false then
    new.deleted_at=now();
    new.deleted_by=auth.uid();
  elsif new.is_deleted is false and old.is_deleted is true then
    new.deleted_at=null;
    new.deleted_by=null;
  else
    new.deleted_at=old.deleted_at;
    new.deleted_by=old.deleted_by;
  end if;
  return new;
end;
$$;

drop trigger if exists schools_soft_delete_audit on public.schools;
create trigger schools_soft_delete_audit before update on public.schools for each row execute function public.set_soft_delete_audit();

drop trigger if exists classrooms_soft_delete_audit on public.classrooms;
create trigger classrooms_soft_delete_audit before update on public.classrooms for each row execute function public.set_soft_delete_audit();

drop trigger if exists test_sessions_soft_delete_audit on public.test_sessions;
create trigger test_sessions_soft_delete_audit before update on public.test_sessions for each row execute function public.set_soft_delete_audit();

drop trigger if exists onsite_evaluations_soft_delete_audit on public.onsite_evaluations;
create trigger onsite_evaluations_soft_delete_audit before update on public.onsite_evaluations for each row execute function public.set_soft_delete_audit();

commit;
