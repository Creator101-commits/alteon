-- Enable Row Level Security on all public tables
-- Uses current_setting('request.jwt.claim.sub', true) to match user_id
-- from the JWT token (consistent with calendar_events migration pattern).
--
-- IMPORTANT: For these policies to work, the Supabase client must send a JWT
-- whose "sub" claim contains the Firebase UID. If you are using the bare anon
-- key without a custom JWT, all RLS checks will silently return no rows.
-- See: https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control

-- Helper: reusable expression for the authenticated user id
-- current_setting('request.jwt.claim.sub', true) returns NULL when the claim
-- is missing, which makes the equality check safely false.

-- ============================================================
-- 1. users
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users FOR SELECT
  USING (id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY users_update ON users FOR UPDATE
  USING (id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY users_delete ON users FOR DELETE
  USING (id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 2. classes
-- ============================================================
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY classes_policy ON classes FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 3. assignments
-- ============================================================
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignments_policy ON assignments FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 4. folders
-- ============================================================
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_policy ON folders FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 5. flashcard_decks
-- ============================================================
ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY flashcard_decks_policy ON flashcard_decks FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 6. flashcards (child of flashcard_decks — no direct user_id)
-- ============================================================
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY flashcards_policy ON flashcards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM flashcard_decks
      WHERE flashcard_decks.id = flashcards.deck_id
        AND flashcard_decks.user_id = current_setting('request.jwt.claim.sub', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flashcard_decks
      WHERE flashcard_decks.id = flashcards.deck_id
        AND flashcard_decks.user_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- ============================================================
-- 7. flashcard_study_progress
-- ============================================================
ALTER TABLE flashcard_study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY flashcard_study_progress_policy ON flashcard_study_progress FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 8. notes
-- ============================================================
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_policy ON notes FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 9. habits
-- ============================================================
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY habits_policy ON habits FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 10. boards
-- ============================================================
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY boards_policy ON boards FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 11. todo_lists (child of boards — no direct user_id)
-- ============================================================
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY todo_lists_policy ON todo_lists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = todo_lists.board_id
        AND boards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = todo_lists.board_id
        AND boards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- ============================================================
-- 12. cards
-- ============================================================
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_policy ON cards FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 13. checklists (child of cards — no direct user_id)
-- ============================================================
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklists_policy ON checklists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = checklists.card_id
        AND cards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = checklists.card_id
        AND cards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- ============================================================
-- 14. labels
-- ============================================================
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY labels_policy ON labels FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 15. card_labels (junction — access if user owns the card)
-- ============================================================
ALTER TABLE card_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY card_labels_policy ON card_labels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = card_labels.card_id
        AND cards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = card_labels.card_id
        AND cards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- ============================================================
-- 16. attachments (child of cards — no direct user_id)
-- ============================================================
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_policy ON attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = attachments.card_id
        AND cards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = attachments.card_id
        AND cards.user_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- ============================================================
-- 17. quick_tasks
-- ============================================================
ALTER TABLE quick_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY quick_tasks_policy ON quick_tasks FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 18. ai_summaries
-- ============================================================
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_summaries_policy ON ai_summaries FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 19. user_preferences (assumes user_id column exists)
-- ============================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_policy ON user_preferences FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));
