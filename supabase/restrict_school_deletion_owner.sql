-- Run once in the Production Supabase SQL Editor.
-- Only arsan113@gmail.com may soft-delete, restore, or permanently delete
-- schools and classrooms. Normal edits remain governed by the existing RLS.

begin;

create or replace function public.is_school_structure_delete_owner()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.profiles
    where id=auth.uid()
      and lower(btrim(email))='arsan113@gmail.com'
  )
$$;

create or replace function public.enforce_school_structure_delete_owner()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    if not public.is_school_structure_delete_owner() then
      raise exception 'Only the designated owner can delete or restore schools and classrooms' using errcode='42501';
    end if;
    return old;
  end if;
  if new.is_deleted is distinct from old.is_deleted then
    if not public.is_school_structure_delete_owner() then
      raise exception 'Only the designated owner can delete or restore schools and classrooms' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists schools_delete_owner_guard on public.schools;
create trigger schools_delete_owner_guard
before update or delete on public.schools
for each row execute function public.enforce_school_structure_delete_owner();

drop trigger if exists classrooms_delete_owner_guard on public.classrooms;
create trigger classrooms_delete_owner_guard
before update or delete on public.classrooms
for each row execute function public.enforce_school_structure_delete_owner();

commit;
