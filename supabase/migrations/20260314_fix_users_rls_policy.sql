begin;

alter table public.users enable row level security;

grant select, insert, update, delete on table public.users to authenticated;

drop policy if exists users_select on public.users;
drop policy if exists users_insert on public.users;
drop policy if exists users_update on public.users;
drop policy if exists users_delete on public.users;

drop policy if exists users_select_own on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;
drop policy if exists users_delete_own on public.users;

create policy users_select_own
on public.users
for select
to authenticated
using (
  id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true))
);

create policy users_insert_own
on public.users
for insert
to authenticated
with check (
  id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true))
);

create policy users_update_own
on public.users
for update
to authenticated
using (
  id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true))
)
with check (
  id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true))
);

create policy users_delete_own
on public.users
for delete
to authenticated
using (
  id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true))
);

commit;
