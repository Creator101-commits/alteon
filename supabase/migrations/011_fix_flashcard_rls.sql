-- Migration: 011 - Fix flashcard RLS (disable for Firebase Auth)
-- The previous migration enabled RLS which blocks the anon key.
-- This project uses Firebase Auth, so RLS is handled at the app layer.

-- Drop the old policies if they exist
DROP POLICY IF EXISTS flashcard_decks_owner ON flashcard_decks;
DROP POLICY IF EXISTS flashcard_decks_public_read ON flashcard_decks;
DROP POLICY IF EXISTS flashcards_owner ON flashcards;
DROP POLICY IF EXISTS flashcards_public_read ON flashcards;
DROP POLICY IF EXISTS study_progress_owner ON flashcard_study_progress;

-- Disable RLS on all flashcard tables
ALTER TABLE flashcard_decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_study_progress DISABLE ROW LEVEL SECURITY;
