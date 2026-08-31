
-- Classroom Locks for Concurrency Control
create table if not exists public.classroom_locks (
    classroom_id text primary key references public.classrooms(id) on delete cascade,
    locked_by uuid references auth.users(id) on delete cascade,
    locked_by_name text,
    locked_at timestamptz not null default now()
);

alter table public.classroom_locks enable row level security;
drop policy if exists "classroom_locks_all" on public.classroom_locks;
create policy "classroom_locks_all" on public.classroom_locks for all using (true) with check (true);

grant all on public.classroom_locks to authenticated;
