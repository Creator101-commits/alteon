-- Calendar Events table
-- Persists user calendar events to Supabase instead of localStorage
CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  type TEXT DEFAULT 'event',          -- assignment, event, class, personal
  color TEXT DEFAULT 'bg-blue-500',
  location TEXT,
  is_all_day BOOLEAN DEFAULT FALSE,
  assignment_id VARCHAR,               -- optional link to an assignment
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(user_id, start_time);

-- Enable Row Level Security
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own events
CREATE POLICY calendar_events_user_policy ON calendar_events
  FOR ALL
  USING (user_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));
