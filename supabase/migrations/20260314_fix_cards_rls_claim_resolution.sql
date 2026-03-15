begin;

alter table public.cards enable row level security;

grant select, insert, update, delete on table public.cards to authenticated;
grant select, insert, update, delete on table public.cards to anon;

drop policy if exists cards_policy on public.cards;
drop policy if exists cards_own on public.cards;

create policy cards_own
on public.cards
for all
to public
using (
  user_id = coalesce(
    auth.jwt() ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), ''))::json ->> 'sub'
  )
)
with check (
  user_id = coalesce(
    auth.jwt() ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), ''))::json ->> 'sub'
  )
);

commit;
