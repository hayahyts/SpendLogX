-- Everything above this line is generated from drizzle/pg. Everything below is
-- written by hand: it is what turns a schema into a safe multi-tenant one.
--
-- Three jobs:
--   1. The server, not the phone, decides what `updated_at` says.
--   2. Nothing is readable or writable except through household membership.
--   3. Joining a household you are not yet in needs one privileged function.

-- --- 1. the server owns updated_at -------------------------------------------
--
-- Two phones cannot be ordered by their own clocks, and the pull cursor walks
-- `updated_at` forward. So the client's value is discarded on every write and
-- Postgres stamps its own. A phone whose clock is ten minutes slow can then no
-- longer hide a row behind another phone's cursor.

create or replace function public.stamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'household', 'household_member', 'category', 'person',
    'account', 'account_valuation', 'txn'
  ] loop
    execute format('drop trigger if exists stamp_updated_at on public.%I', t);
    execute format(
      'create trigger stamp_updated_at before insert or update on public.%I
         for each row execute function public.stamp_updated_at()', t);
  end loop;
end;
$$;

-- The pull asks for everything at or after a cursor, ordered by `updated_at`.
-- Without these it is a sequential scan of the whole table on every poll.
create index if not exists household_updated on public.household (updated_at);
create index if not exists household_member_updated on public.household_member (updated_at);
create index if not exists category_updated on public.category (updated_at);
create index if not exists person_updated on public.person (updated_at);
create index if not exists account_updated on public.account (updated_at);
create index if not exists account_valuation_updated on public.account_valuation (updated_at);
create index if not exists txn_updated on public.txn (updated_at);

-- --- 2. membership is the only key -------------------------------------------
--
-- `is_member` is security definer so that it can read household_member without
-- itself going through household_member's policy. Without that the policy would
-- have to query the table it is guarding, and Postgres would recurse.
--
-- It is also the reason the policies below are one line each: every table
-- answers the same question, and only account_valuation has to reach through a
-- join to ask it.

create or replace function public.is_member(p_household_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_member m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()::text
      and m.deleted_at is null
  );
$$;

revoke all on function public.is_member(text) from public;
grant execute on function public.is_member(text) to authenticated;

alter table public.household            enable row level security;
alter table public.household_member     enable row level security;
alter table public.category             enable row level security;
alter table public.person               enable row level security;
alter table public.account              enable row level security;
alter table public.account_valuation    enable row level security;
alter table public.txn                  enable row level security;

-- Force it for the table owner too, so a future function that forgets
-- `security invoker` cannot quietly read across households.
alter table public.household            force row level security;
alter table public.household_member     force row level security;
alter table public.category             force row level security;
alter table public.person               force row level security;
alter table public.account              force row level security;
alter table public.account_valuation    force row level security;
alter table public.txn                  force row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'household', 'household_member', 'category', 'person',
    'account', 'account_valuation', 'txn'
  ] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('drop policy if exists %I_modify on public.%I', t, t);
    execute format('drop policy if exists %I_create on public.%I', t, t);
  end loop;
end;
$$;

-- household. Creating one is open to any signed-in account, because at that
-- instant nobody is a member of it yet — there is nothing to protect, and the
-- row is useless until the creator's own member row lands beside it. Reading
-- and changing one is members only.
create policy household_create on public.household
  for insert to authenticated with check (true);
create policy household_read on public.household
  for select to authenticated using (public.is_member(id));
create policy household_modify on public.household
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

-- household_member. You may add exactly one row: your own. Everything else
-- about the household's membership is the server's to write, through
-- join_household. That is what stops a signed-in stranger writing themselves
-- into a household whose id they happened to learn.
create policy household_member_create on public.household_member
  for insert to authenticated with check (user_id = auth.uid()::text);
create policy household_member_read on public.household_member
  for select to authenticated using (public.is_member(household_id));
create policy household_member_modify on public.household_member
  for update to authenticated
  using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- The rest carry a household_id, so they are all the same policy.
do $$
declare t text;
begin
  foreach t in array array['category', 'person', 'account', 'txn'] loop
    execute format(
      'create policy %I_read on public.%I for select to authenticated
         using (public.is_member(household_id))', t, t);
    execute format(
      'create policy %I_create on public.%I for insert to authenticated
         with check (public.is_member(household_id))', t, t);
    execute format(
      'create policy %I_modify on public.%I for update to authenticated
         using (public.is_member(household_id))
         with check (public.is_member(household_id))', t, t);
  end loop;
end;
$$;

-- account_valuation hangs off an account rather than a household, so it asks
-- the same question one join further out.
create policy account_valuation_read on public.account_valuation
  for select to authenticated using (exists (
    select 1 from public.account a
    where a.id = account_id and public.is_member(a.household_id)));
create policy account_valuation_create on public.account_valuation
  for insert to authenticated with check (exists (
    select 1 from public.account a
    where a.id = account_id and public.is_member(a.household_id)));
create policy account_valuation_modify on public.account_valuation
  for update to authenticated using (exists (
    select 1 from public.account a
    where a.id = account_id and public.is_member(a.household_id)));

-- Nothing is ever deleted. Rows carry `deleted_at` instead, because a sync
-- needs a tombstone to tell "removed on the other phone" from "not arrived
-- yet". No delete policy exists, so a delete is refused rather than merely
-- discouraged.

-- --- 3. joining ---------------------------------------------------------------
--
-- Someone joining cannot read the household they are joining, so this runs with
-- the privilege to look it up on their behalf. It adds only the caller, and it
-- returns only the one household the code matched — a wrong code gets an error,
-- never a row.

create or replace function public.join_household(
  p_invite_code text,
  p_display_name text
)
returns table (id text, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household public.household%rowtype;
  v_uid text := auth.uid()::text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select * into v_household
  from public.household h
  where upper(h.invite_code) = upper(trim(p_invite_code))
    and h.deleted_at is null;

  if not found then
    raise exception 'That code does not match a household.';
  end if;

  insert into public.household_member (
    id, household_id, user_id, email, display_name, role
  )
  values (
    'member_' || replace(v_uid, '-', ''),
    v_household.id, v_uid, auth.jwt() ->> 'email',
    coalesce(nullif(trim(p_display_name), ''), 'Member'), 'member'
  )
  on conflict (household_id, user_id) do update
    set display_name = excluded.display_name,
        deleted_at = null;

  return query
    select v_household.id, v_household.name, v_household.invite_code;
end;
$$;

revoke all on function public.join_household(text, text) from public;
grant execute on function public.join_household(text, text) to authenticated;
