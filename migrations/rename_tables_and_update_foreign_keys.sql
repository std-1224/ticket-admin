-- Migration to rename tables and update foreign key references for ticket-admin
-- This migration implements the schema changes requested:
-- 1. users -> profiles
-- 2. scans -> event_scans
-- 3. Update foreign key references

-- Start transaction
BEGIN;

-- Step 1: Rename tables
ALTER TABLE users RENAME TO profiles;
ALTER TABLE scans RENAME TO event_scans;

-- Step 2: Update foreign key constraints and references
-- Update all foreign key references from users to profiles

-- Update events table foreign keys
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE events ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update tickets table foreign keys
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchaser_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_purchaser_id_fkey 
    FOREIGN KEY (purchaser_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update event_scans table foreign keys
ALTER TABLE event_scans DROP CONSTRAINT IF EXISTS scans_scanned_by_fkey;
ALTER TABLE event_scans ADD CONSTRAINT event_scans_scanned_by_fkey 
    FOREIGN KEY (scanned_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- Step 3: Update indexes
-- Drop old indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_scans_order_item_id;
DROP INDEX IF EXISTS idx_scans_scanned_by;
DROP INDEX IF EXISTS idx_scans_scanned_at;

-- Create new indexes with updated names
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_event_scans_order_item_id ON event_scans(order_item_id);
CREATE INDEX idx_event_scans_scanned_by ON event_scans(scanned_by);
CREATE INDEX idx_event_scans_scanned_at ON event_scans(scanned_at);

-- Step 4: Update any stored procedures or functions that reference the old table names
-- The get_available_tickets function doesn't reference renamed tables, so no update needed
-- The validate_ticket function may need updates if it references scans table

-- Update validate_ticket function if it exists and references scans table
-- This is a placeholder - actual function update would depend on the current implementation

COMMIT;

-- Rollback script (run this if you need to revert the changes)
/*
BEGIN;

-- Revert table renames
ALTER TABLE profiles RENAME TO users;
ALTER TABLE event_scans RENAME TO scans;

-- Revert foreign key constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE events ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchaser_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_purchaser_id_fkey 
    FOREIGN KEY (purchaser_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE scans DROP CONSTRAINT IF EXISTS event_scans_scanned_by_fkey;
ALTER TABLE scans ADD CONSTRAINT scans_scanned_by_fkey 
    FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE CASCADE;

-- Revert indexes
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_event_scans_order_item_id;
DROP INDEX IF EXISTS idx_event_scans_scanned_by;
DROP INDEX IF EXISTS idx_event_scans_scanned_at;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_scans_order_item_id ON scans(order_item_id);
CREATE INDEX idx_scans_scanned_by ON scans(scanned_by);
CREATE INDEX idx_scans_scanned_at ON scans(scanned_at);

COMMIT;
*/
