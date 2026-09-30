-- rls_enabled_no_policy lint: an explicit deny-all policy. authenticated still has no grant on the table,
-- so access is unchanged (definer trigger + service role only).
create policy notice_queue_none on public.tracker_notice_queue for select to authenticated using (false);
