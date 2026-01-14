-- Project Tracker Schema
-- Run with: supabase db reset

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PROFILES TABLE (simplified from original)
-- =============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ITEMS TABLE (self-referential for infinite nesting)
-- =============================================================================
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES items(id) ON DELETE CASCADE,

    -- Core fields
    title TEXT NOT NULL,
    description TEXT,

    -- Status workflow
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done', 'archived')),

    -- Priority
    priority TEXT NOT NULL DEFAULT 'none'
        CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),

    -- Dates
    due_date DATE,
    start_date DATE,
    completed_at TIMESTAMPTZ,

    -- Ordering (for manual sorting within parent/status)
    position INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_items_user_parent ON items(user_id, parent_id);
CREATE INDEX idx_items_user_status ON items(user_id, status);
CREATE INDEX idx_items_user_due ON items(user_id, due_date);
CREATE INDEX idx_items_parent_position ON items(parent_id, position);
CREATE INDEX idx_items_user_position ON items(user_id, position) WHERE parent_id IS NULL;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-set position on insert
CREATE OR REPLACE FUNCTION set_item_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position = 0 THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM items
        WHERE user_id = NEW.user_id
        AND (parent_id IS NOT DISTINCT FROM NEW.parent_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_item_position
    BEFORE INSERT ON items
    FOR EACH ROW
    EXECUTE FUNCTION set_item_position();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only manage their own profile
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" ON profiles
    FOR DELETE USING (auth.uid() = id);

-- Items: users can only manage their own items
CREATE POLICY "Users can view their own items" ON items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own items" ON items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" ON items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" ON items
    FOR DELETE USING (auth.uid() = user_id);
