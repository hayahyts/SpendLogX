-- What Supabase supplies that a bare Postgres does not, so supabase/setup.sql
-- can be run and its policies actually exercised on a local cluster.
--
-- Only the parts the setup file touches: the two roles, and the two auth
-- helpers that every policy is written against. `auth.uid()` reads a session
-- setting here instead of a JWT, which is how a test switches user.

create schema if not exists auth;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
