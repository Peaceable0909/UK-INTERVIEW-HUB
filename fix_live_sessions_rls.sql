-- Fix: live_sessions was readable by fully unauthenticated (anon) requests, exposing
-- private zoom links / schedules to anyone with the public anon key.
drop policy if exists "Anyone can read sessions" on public.live_sessions;
create policy "Authenticated can read sessions" on public.live_sessions
  for select to authenticated using (true);

-- Tighten the same pattern on student_notifications: broadcast/self notifications
-- should require a real session, not just the anon key.
drop policy if exists "Students can read their notifications" on public.student_notifications;
create policy "Students can read their notifications" on public.student_notifications
  for select to authenticated using (
    target = 'all'
    or target_user_id = auth.uid()
    or (
      target <> 'all' and target_user_id is null and target = (
        select student_progress.selected_university
        from public.student_progress
        where student_progress.user_id = auth.uid()
        limit 1
      )
    )
  );

-- Hardening flagged by the Supabase security advisor: is_admin() is SECURITY DEFINER
-- and doesn't need to be callable by signed-out (anon) requests at all.
revoke execute on function public.is_admin() from anon;
