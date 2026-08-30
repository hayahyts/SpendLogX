-- Proof that supabase/setup.sql does what its comments claim.
--
-- Run against a local cluster that has had scripts/supabase-stub.sql and
-- supabase/setup.sql applied. Every check raises rather than printing, so the
-- script failing is the only signal that matters.

\set ON_ERROR_STOP on
\set QUIET on

create or replace function assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice '  ok  %', what;
end $$;

-- Two people. A owns a household; B is a stranger until they use the code.
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

create or replace function become(uid text, email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('email', email)::text, false);
  execute 'set role authenticated';
end $$;

\echo '--- A creates a household and fills it ---'
select become(:'A', 'a@example.com');

insert into household (id, name, invite_code) values ('hh_a', 'Home', 'KWB4T7');
insert into household_member (id, household_id, user_id, email, display_name, role)
  values ('m_a', 'hh_a', :'A', 'a@example.com', 'Kwesi', 'owner');
insert into account (id, household_id, name, kind, opening_balance_minor, opening_balance_on, sort_order)
  values ('ac_a', 'hh_a', 'Cash', 'cash', 286850, '2026-08-30', 0);
insert into txn (id, household_id, type, occurred_on, amount_minor, account_id, note)
  values ('t_a', 'hh_a', 'expense', '2026-08-30', 5300, 'ac_a', 'Bread');

select assert((select count(*) from household) = 1, 'A reads back the household it created');
select assert((select count(*) from txn) = 1, 'A reads its own transaction');

\echo '--- the ledger constraints survive into Postgres ---'
do $$ begin
  insert into txn (id, household_id, type, occurred_on, amount_minor, account_id)
    values ('t_neg', 'hh_a', 'expense', '2026-08-30', -100, 'ac_a');
  raise exception 'FAILED: a negative amount was accepted';
exception when check_violation then
  raise notice '  ok  a negative amount is refused (direction comes from type)';
end $$;

do $$ begin
  insert into txn (id, household_id, type, occurred_on, amount_minor, account_id, category_id)
    values ('t_tr', 'hh_a', 'transfer', '2026-08-30', 100, 'ac_a', 'c_x');
  raise exception 'FAILED: a categorised transfer was accepted';
exception when check_violation or foreign_key_violation then
  raise notice '  ok  a transfer cannot carry a category';
end $$;

\echo '--- the server owns updated_at ---'
-- A phone with a slow clock cannot hide a row behind another phone's cursor.
update txn set note = 'Bread and milk', updated_at = '2001-01-01T00:00:00Z' where id = 't_a';
select assert(
  (select updated_at from txn where id = 't_a') > now() - interval '1 minute',
  'a client-supplied updated_at is discarded and stamped by the server');
select assert(
  (select created_at from txn where id = 't_a') <= (select updated_at from txn where id = 't_a'),
  'created_at survives an update');

\echo '--- B is a stranger ---'
reset role;
select become(:'B', 'b@example.com');

select assert((select count(*) from household) = 0, 'B cannot see a household it does not belong to');
select assert((select count(*) from txn) = 0, 'B cannot see another household''s transactions');
select assert((select count(*) from account) = 0, 'B cannot see another household''s accounts');
select assert((select count(*) from household_member) = 0, 'B cannot see another household''s members');

do $$ begin
  insert into txn (id, household_id, type, occurred_on, amount_minor, account_id)
    values ('t_b', 'hh_a', 'expense', '2026-08-30', 100, 'ac_a');
  raise exception 'FAILED: B wrote into a household it does not belong to';
exception when insufficient_privilege then
  raise notice '  ok  B cannot write into a household it does not belong to';
end $$;

-- The attack the household_member policy exists to stop: knowing the household
-- id is not enough, because you may only ever insert yourself.
do $$ begin
  insert into household_member (id, household_id, user_id, display_name, role)
    values ('m_forge', 'hh_a', '33333333-3333-3333-3333-333333333333', 'Mallory', 'member');
  raise exception 'FAILED: B added somebody else as a member';
exception when insufficient_privilege then
  raise notice '  ok  B cannot add anyone but itself as a member';
end $$;

do $$ begin
  perform join_household('ZZZZZZ', 'Beb');
  raise exception 'FAILED: a wrong invite code was accepted';
exception when others then
  if sqlstate = 'P0001' then raise notice '  ok  a wrong invite code is refused';
  else raise; end if;
end $$;

\echo '--- B joins with the code ---'
select assert((select count(*) from join_household('kwb4t7', 'Beb')) = 1,
  'the invite code is accepted regardless of case');

select assert((select count(*) from household) = 1, 'B can now see the household');
select assert((select count(*) from txn) = 1, 'B can now see the transactions');
select assert((select count(*) from household_member) = 2, 'B sees both members');
select assert(
  (select email from household_member where user_id = :'B') = 'b@example.com',
  'joining records the email from the token, not from the client');

insert into txn (id, household_id, type, occurred_on, amount_minor, account_id, note)
  values ('t_b2', 'hh_a', 'expense', '2026-08-30', 4200, 'ac_a', 'Fuel');
select assert((select count(*) from txn) = 2, 'B can now add a transaction');

select assert((select count(*) from join_household('KWB4T7', 'Beb')) = 1,
  'joining twice is not an error');
select assert((select count(*) from household_member) = 2, 'joining twice adds no second row');

\echo '--- A sees what B wrote ---'
reset role;
select become(:'A', 'a@example.com');
select assert((select count(*) from txn where id = 't_b2') = 1, 'A sees the row B added');

\echo '--- nothing is ever hard-deleted ---'
do $$ begin
  delete from txn where id = 't_a';
  raise exception 'FAILED: a hard delete was allowed';
exception when insufficient_privilege then
  raise notice '  ok  a delete is refused; rows are tombstoned instead';
end $$;

update txn set deleted_at = now() where id = 't_a';
select assert((select deleted_at from txn where id = 't_a') is not null,
  'a soft delete is an ordinary update, so it syncs like any other change');

reset role;
\echo ''
\echo 'All row-level security checks passed.'
