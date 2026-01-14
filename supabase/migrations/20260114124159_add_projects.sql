-- Migration: Add Projects feature
-- Adds projects table and project_id to items for organizing items by project

-- =============================================================================
-- PROJECTS TABLE
-- =============================================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Core fields
    title TEXT NOT NULL,
    description TEXT,

    -- Customization
    color TEXT NOT NULL DEFAULT 'blue'
        CHECK (color IN ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink', 'gray')),
    icon TEXT,

    -- Ordering
    position INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ADD PROJECT_ID TO ITEMS
-- =============================================================================
ALTER TABLE items ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_user_position ON projects(user_id, position);
CREATE INDEX idx_items_project ON items(project_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-set position for projects on insert
CREATE OR REPLACE FUNCTION set_project_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position = 0 THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM projects
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_project_position
    BEFORE INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION set_project_position();

-- Add updated_at trigger for projects (reuses existing function)
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);
