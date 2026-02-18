-- Migration: Drop all flashcard-related tables to start fresh
-- This removes the old flashcard implementation completely

-- Drop the view first (depends on flashcard_reviews)
DROP VIEW IF EXISTS v_daily_review_stats CASCADE;

-- Drop flashcard_reviews first (depends on flashcards and flashcard_decks)
DROP TABLE IF EXISTS flashcard_reviews CASCADE;

-- Drop flashcards table (depends on flashcard_decks)
DROP TABLE IF EXISTS flashcards CASCADE;

-- Drop flashcard_decks table
DROP TABLE IF EXISTS flashcard_decks CASCADE;

-- Note: We keep the folders table as it's shared with notes
-- The new flashcard implementation will use a different structure
