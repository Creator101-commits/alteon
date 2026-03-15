-- Diagnostic script for users/cards RLS
-- Run in Supabase SQL Editor after replacing TEST_UID.
-- This script rolls back at the end, so no data is persisted.

begin;

-- 1) Policy and grant visibility
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('users', 'cards')
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('users', 'cards')
  and grantee in ('authenticated', 'anon')
order by table_name, grantee, privilege_type;

-- 2) Simulate JWT subject and authenticated role for RLS checks
set local role authenticated;
set local "request.jwt.claim.sub" = 'TEST_UID_REPLACE_WITH_FIREBASE_UID';

-- 3) Read checks under policy
select id, email
from public.users
where id = current_setting('request.jwt.claim.sub', true);

select id, user_id, title
from public.cards
where user_id = current_setting('request.jwt.claim.sub', true)
limit 5;

-- 4) Write checks under policy (rolled back)
insert into public.users (id, email, name)
values (
  current_setting('request.jwt.claim.sub', true),
  'rls-check@example.com',
  'RLS Check User'
)
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name
returning id, email;

rollback;
