-- Migration: 010 - Recreate flashcard tables with new schema
-- Supports deck creation, viewing, studying, and spaced repetition

-- ============================================================
-- 1. flashcard_decks — one row per deck/set
-- ============================================================
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id     VARCHAR REFERENCES folders(id) ON DELETE SET NULL,
  title         TEXT    NOT NULL DEFAULT 'Untitled Deck',
  description   TEXT    DEFAULT '',
  tags          TEXT[]  DEFAULT '{}',
  is_public     BOOLEAN DEFAULT FALSE,
  card_count    INTEGER DEFAULT 0,           -- denormalized for fast display
  last_studied  TIMESTAMP,                   -- when the user last opened the deck
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. flashcards — individual cards inside a deck
-- ============================================================
CREATE TABLE IF NOT EXISTS flashcards (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id         VARCHAR NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  term            TEXT    NOT NULL DEFAULT '',
  definition      TEXT    NOT NULL DEFAULT '',
  term_image      TEXT,                        -- optional image URL for term side
  definition_image TEXT,                       -- optional image URL for definition side
  term_audio      TEXT,                        -- optional audio URL for term side
  definition_audio TEXT,                       -- optional audio URL for definition side
  position        INTEGER DEFAULT 0,           -- card order within the deck
  is_starred      BOOLEAN DEFAULT FALSE,       -- user-starred card
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 3. flashcard_study_progress — per-card study state (spaced repetition)
-- ============================================================
CREATE TABLE IF NOT EXISTS flashcard_study_progress (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id         VARCHAR NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  ease_factor     REAL    DEFAULT 2.5,         -- SM-2 ease factor
  interval_days   INTEGER DEFAULT 0,           -- current interval in days
  repetitions     INTEGER DEFAULT 0,           -- number of successful reviews
  next_review     TIMESTAMP,                   -- when the card is next due
  last_reviewed   TIMESTAMP,                   -- when the user last reviewed this card
  quality         INTEGER DEFAULT 0,           -- last quality grade (0-5)
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, card_id)                     -- one progress row per user+card
);

-- ============================================================
-- 4. Indexes for fast lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user     ON flashcard_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_folder   ON flashcard_decks(folder_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck          ON flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_position      ON flashcards(deck_id, position);
CREATE INDEX IF NOT EXISTS idx_study_progress_user      ON flashcard_study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_card      ON flashcard_study_progress(card_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_next      ON flashcard_study_progress(user_id, next_review);

-- ============================================================
-- 5. Trigger: auto-update updated_at on flashcard_decks
-- ============================================================
CREATE OR REPLACE FUNCTION update_flashcard_deck_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_flashcard_decks_updated ON flashcard_decks;
CREATE TRIGGER trg_flashcard_decks_updated
  BEFORE UPDATE ON flashcard_decks
  FOR EACH ROW EXECUTE FUNCTION update_flashcard_deck_timestamp();

-- ============================================================
-- 6. Trigger: auto-update card_count on flashcard_decks when cards change
-- ============================================================
CREATE OR REPLACE FUNCTION update_deck_card_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE flashcard_decks SET card_count = (
      SELECT COUNT(*) FROM flashcards WHERE deck_id = OLD.deck_id
    ) WHERE id = OLD.deck_id;
    RETURN OLD;
  ELSE
    UPDATE flashcard_decks SET card_count = (
      SELECT COUNT(*) FROM flashcards WHERE deck_id = NEW.deck_id
    ) WHERE id = NEW.deck_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_flashcards_count ON flashcards;
CREATE TRIGGER trg_flashcards_count
  AFTER INSERT OR DELETE ON flashcards
  FOR EACH ROW EXECUTE FUNCTION update_deck_card_count();

-- ============================================================
-- 7. RLS - DISABLED (Firebase Auth, not Supabase Auth)
-- ============================================================
-- Since we use Firebase Auth and the anon key, RLS is enforced
-- at the application layer by filtering on user_id in queries.
-- This is consistent with all other tables (see 001_initial_schema.sql).

ALTER TABLE flashcard_decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_study_progress DISABLE ROW LEVEL SECURITY;
