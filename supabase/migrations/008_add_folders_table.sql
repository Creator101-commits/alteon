-- Migration: Add folders table and folder_id columns for unified file organization
-- This migration adds support for organizing notes and flashcard decks in folders

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_folder_id VARCHAR REFERENCES folders(id) ON DELETE CASCADE,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_expanded BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add folder_id column to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS folder_id VARCHAR REFERENCES folders(id) ON DELETE SET NULL;

-- Add folder_id column to flashcard_decks table
ALTER TABLE flashcard_decks 
ADD COLUMN IF NOT EXISTS folder_id VARCHAR REFERENCES folders(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_folder_id ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_folder_id ON flashcard_decks(folder_id);

-- Create updated_at trigger for folders
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS folders_updated_at ON folders;
CREATE TRIGGER folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_folders_updated_at();

-- Add comments for documentation
COMMENT ON TABLE folders IS 'Unified folder structure for organizing notes and flashcard decks';
COMMENT ON COLUMN folders.parent_folder_id IS 'Reference to parent folder for nested folder hierarchy';
COMMENT ON COLUMN folders.is_expanded IS 'UI state for tree view - whether folder is expanded or collapsed';
COMMENT ON COLUMN notes.folder_id IS 'Reference to folder for unified file organization';
COMMENT ON COLUMN flashcard_decks.folder_id IS 'Reference to folder for unified file organization';
