revoke update on public.tracker_shares from authenticated;
grant update (label, revoked_at) on public.tracker_shares to authenticated;
