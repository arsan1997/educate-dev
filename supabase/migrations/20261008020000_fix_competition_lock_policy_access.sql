-- Competition session/result RLS policies inspect the lock table during an
-- upsert. PostgreSQL therefore requires the authenticated role to have SELECT
-- on that table even when the insert path does not hit a conflict.
-- Expose only the current user's own, non-expired lock row; all lock mutations
-- remain restricted to the SECURITY DEFINER RPCs.

drop policy if exists "competition_lock_owner_select" on public.competition_session_locks;
create policy "competition_lock_owner_select" on public.competition_session_locks
for select to authenticated
using (
  locked_by=auth.uid()
  and locked_at>=now()-interval '5 minutes'
);

grant select on public.competition_session_locks to authenticated;

notify pgrst, 'reload schema';
