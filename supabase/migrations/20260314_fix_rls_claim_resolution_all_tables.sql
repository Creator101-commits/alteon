begin;

-- Unified helper for extracting Firebase UID from Supabase/PostgREST JWT claims.
create or replace function public.request_uid()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), ''))::json ->> 'sub'
  );
$$;

-- USERS
alter table if exists public.users enable row level security;
drop policy if exists users_claims_compat on public.users;
create policy users_claims_compat
on public.users
for all
to public
using (id = public.request_uid())
with check (id = public.request_uid());

-- DIRECT user_id TABLES
alter table if exists public.classes enable row level security;
drop policy if exists classes_claims_compat on public.classes;
create policy classes_claims_compat
on public.classes
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.assignments enable row level security;
drop policy if exists assignments_claims_compat on public.assignments;
create policy assignments_claims_compat
on public.assignments
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.folders enable row level security;
drop policy if exists folders_claims_compat on public.folders;
create policy folders_claims_compat
on public.folders
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.flashcard_decks enable row level security;
drop policy if exists flashcard_decks_claims_compat on public.flashcard_decks;
create policy flashcard_decks_claims_compat
on public.flashcard_decks
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.flashcard_study_progress enable row level security;
drop policy if exists flashcard_study_progress_claims_compat on public.flashcard_study_progress;
create policy flashcard_study_progress_claims_compat
on public.flashcard_study_progress
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.notes enable row level security;
drop policy if exists notes_claims_compat on public.notes;
create policy notes_claims_compat
on public.notes
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.habits enable row level security;
drop policy if exists habits_claims_compat on public.habits;
create policy habits_claims_compat
on public.habits
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.boards enable row level security;
drop policy if exists boards_claims_compat on public.boards;
create policy boards_claims_compat
on public.boards
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.cards enable row level security;
drop policy if exists cards_claims_compat on public.cards;
create policy cards_claims_compat
on public.cards
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.labels enable row level security;
drop policy if exists labels_claims_compat on public.labels;
create policy labels_claims_compat
on public.labels
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.quick_tasks enable row level security;
drop policy if exists quick_tasks_claims_compat on public.quick_tasks;
create policy quick_tasks_claims_compat
on public.quick_tasks
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.ai_summaries enable row level security;
drop policy if exists ai_summaries_claims_compat on public.ai_summaries;
create policy ai_summaries_claims_compat
on public.ai_summaries
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.user_preferences enable row level security;
drop policy if exists user_preferences_claims_compat on public.user_preferences;
create policy user_preferences_claims_compat
on public.user_preferences
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

alter table if exists public.calendar_events enable row level security;
drop policy if exists calendar_events_claims_compat on public.calendar_events;
create policy calendar_events_claims_compat
on public.calendar_events
for all
to public
using (user_id = public.request_uid())
with check (user_id = public.request_uid());

-- CHILD/JOIN TABLES
alter table if exists public.flashcards enable row level security;
drop policy if exists flashcards_claims_compat on public.flashcards;
create policy flashcards_claims_compat
on public.flashcards
for all
to public
using (
  exists (
    select 1
    from public.flashcard_decks d
    where d.id = flashcards.deck_id
      and d.user_id = public.request_uid()
  )
)
with check (
  exists (
    select 1
    from public.flashcard_decks d
    where d.id = flashcards.deck_id
      and d.user_id = public.request_uid()
  )
);

alter table if exists public.todo_lists enable row level security;
drop policy if exists todo_lists_claims_compat on public.todo_lists;
create policy todo_lists_claims_compat
on public.todo_lists
for all
to public
using (
  exists (
    select 1
    from public.boards b
    where b.id = todo_lists.board_id
      and b.user_id = public.request_uid()
  )
)
with check (
  exists (
    select 1
    from public.boards b
    where b.id = todo_lists.board_id
      and b.user_id = public.request_uid()
  )
);

alter table if exists public.checklists enable row level security;
drop policy if exists checklists_claims_compat on public.checklists;
create policy checklists_claims_compat
on public.checklists
for all
to public
using (
  exists (
    select 1
    from public.cards c
    where c.id = checklists.card_id
      and c.user_id = public.request_uid()
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = checklists.card_id
      and c.user_id = public.request_uid()
  )
);

alter table if exists public.card_labels enable row level security;
drop policy if exists card_labels_claims_compat on public.card_labels;
create policy card_labels_claims_compat
on public.card_labels
for all
to public
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_labels.card_id
      and c.user_id = public.request_uid()
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_labels.card_id
      and c.user_id = public.request_uid()
  )
);

alter table if exists public.attachments enable row level security;
drop policy if exists attachments_claims_compat on public.attachments;
create policy attachments_claims_compat
on public.attachments
for all
to public
using (
  exists (
    select 1
    from public.cards c
    where c.id = attachments.card_id
      and c.user_id = public.request_uid()
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = attachments.card_id
      and c.user_id = public.request_uid()
  )
);

commit;
