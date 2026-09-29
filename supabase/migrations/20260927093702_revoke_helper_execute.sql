-- Only signed-in users need the RLS helper; authenticated keeps its explicit EXECUTE grant.
revoke execute on function public.is_tracker_user() from anon, public;
