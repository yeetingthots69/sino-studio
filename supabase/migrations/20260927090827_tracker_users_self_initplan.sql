-- auth_rls_initplan lint: wrap auth.jwt() itself in a scalar subquery.
alter policy users_self on public.tracker_users
  using (email = lower((select auth.jwt())->>'email'));
