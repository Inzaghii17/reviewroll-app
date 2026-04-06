-- ============================================================
-- Migration: Add TMDB_ID column to Movie table for streaming
-- This migration adds support for free streaming via embed providers
-- Run once: mysql -u root -p reviewroll < db/migration_streaming_01.sql
-- ============================================================

USE reviewroll;

-- Add TMDB_ID column if not already present
ALTER TABLE Movie ADD COLUMN TMDB_ID INT DEFAULT NULL UNIQUE AFTER Movie_ID;

-- Add index for better performance
CREATE INDEX idx_movie_tmdb_id ON Movie(TMDB_ID);

-- Success message
SELECT 'Migration complete: TMDB_ID column added to Movie table' AS status;
