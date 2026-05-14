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

    -- Focus session settings
    default_warning_buffer_sec INT NOT NULL DEFAULT 180,
    default_break_duration_sec INT NOT NULL DEFAULT 180,
    preferred_time_increments INT[] NOT NULL DEFAULT '{1,5,10,15}',
    tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'premium')),

    -- Metadata
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
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

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

    -- Calendar scheduling (week view)
    scheduled_start TIMESTAMPTZ,
    duration_minutes INT NOT NULL DEFAULT 30
        CHECK (duration_minutes > 0),

    -- Focus session fields
    intention TEXT,
    cumulative_time_ms BIGINT NOT NULL DEFAULT 0,
    session_count INT NOT NULL DEFAULT 0,

    -- Ordering (for manual sorting within parent/status)
    position INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TIME ENTRIES TABLE (for time tracking)
-- =============================================================================
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,              -- NULL = currently running
    duration_seconds INTEGER,           -- computed on stop for fast aggregation

    -- Optional note
    note TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- FOCUS SESSIONS
-- =============================================================================
CREATE TABLE focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'setup'
        CHECK (status IN ('setup', 'active', 'paused', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_pause_ms BIGINT NOT NULL DEFAULT 0,
    total_break_ms BIGINT NOT NULL DEFAULT 0,
    total_active_ms BIGINT NOT NULL DEFAULT 0,
    template_id UUID,
    ended_by TEXT CHECK (ended_by IN ('completed', 'abandoned', 'free_tier_cap')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SESSION TASKS
-- =============================================================================
CREATE TABLE session_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position INT NOT NULL,
    allocated_time_ms BIGINT NOT NULL,
    actual_time_ms BIGINT NOT NULL DEFAULT 0,
    warning_buffer_sec INT NOT NULL DEFAULT 180,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'completed', 'paused_incomplete', 'skipped')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    extensions_ms BIGINT NOT NULL DEFAULT 0,
    extension_count INT NOT NULL DEFAULT 0,
    UNIQUE (session_id, position),
    UNIQUE (session_id, task_id)
);

-- =============================================================================
-- SESSION TEMPLATES
-- =============================================================================
CREATE TABLE session_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE focus_sessions
    ADD CONSTRAINT fk_focus_sessions_template
    FOREIGN KEY (template_id) REFERENCES session_templates(id) ON DELETE SET NULL;

-- =============================================================================
-- REMINDERS
-- =============================================================================
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('global', 'task', 'session')),
    source_id UUID,
    delivery TEXT NOT NULL DEFAULT 'visual'
        CHECK (delivery IN ('visual', 'audio', 'both')),
    audio_url TEXT,
    trigger_type TEXT NOT NULL
        CHECK (trigger_type IN ('interval', 'moment', 'manual')),
    trigger_interval_ms BIGINT,
    trigger_moment TEXT,
    trigger_timestamp_ms BIGINT,
    triggers_log_type_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- LOG TYPES
-- =============================================================================
CREATE TABLE log_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    input_type TEXT NOT NULL
        CHECK (input_type IN ('numeric_scale', 'text', 'multiple_choice')),
    config JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

ALTER TABLE reminders
    ADD CONSTRAINT fk_reminders_log_type
    FOREIGN KEY (triggers_log_type_id) REFERENCES log_types(id) ON DELETE SET NULL;

-- =============================================================================
-- LOG ENTRIES (append-only)
-- =============================================================================
CREATE TABLE log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
    session_task_id UUID REFERENCES session_tasks(id) ON DELETE SET NULL,
    log_type_id UUID NOT NULL REFERENCES log_types(id) ON DELETE CASCADE,
    value_numeric NUMERIC,
    value_text TEXT,
    value_choice TEXT,
    source TEXT NOT NULL
        CHECK (source IN ('manual', 'reminder_prompt', 'session_end')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SESSION REFLECTIONS
-- =============================================================================
CREATE TABLE session_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    how_it_went INT CHECK (how_it_went BETWEEN 1 AND 5),
    wins TEXT,
    friction TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id)
);

-- =============================================================================
-- BREAKS
-- =============================================================================
CREATE TABLE breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    planned_duration_sec INT,
    break_type TEXT NOT NULL
        CHECK (break_type IN ('between_tasks', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
-- Projects indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_user_position ON projects(user_id, position);

-- Items indexes
CREATE INDEX idx_items_user_parent ON items(user_id, parent_id);
CREATE INDEX idx_items_user_status ON items(user_id, status);
CREATE INDEX idx_items_user_due ON items(user_id, due_date);
CREATE INDEX idx_items_user_scheduled ON items(user_id, scheduled_start)
    WHERE scheduled_start IS NOT NULL;
CREATE INDEX idx_items_parent_position ON items(parent_id, position);
CREATE INDEX idx_items_user_position ON items(user_id, position) WHERE parent_id IS NULL;
CREATE INDEX idx_items_project ON items(project_id);

-- Time entries indexes
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_item ON time_entries(item_id);
CREATE INDEX idx_time_entries_user_running ON time_entries(user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_time_entries_user_started ON time_entries(user_id, started_at);

-- Focus session indexes
CREATE INDEX idx_focus_sessions_user_status ON focus_sessions(user_id, status);
CREATE INDEX idx_session_tasks_session ON session_tasks(session_id, position);
CREATE INDEX idx_reminders_source ON reminders(source_type, source_id);
CREATE INDEX idx_reminders_user_active ON reminders(user_id) WHERE is_active = true;
CREATE INDEX idx_log_entries_session ON log_entries(session_id, created_at);
CREATE INDEX idx_log_entries_user_type ON log_entries(user_id, log_type_id, created_at);
CREATE INDEX idx_breaks_session ON breaks(session_id);
CREATE INDEX idx_session_templates_user ON session_templates(user_id);

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

CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_time_entries_updated_at
    BEFORE UPDATE ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_focus_sessions_updated_at
    BEFORE UPDATE ON focus_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_session_templates_updated_at
    BEFORE UPDATE ON session_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_log_types_updated_at
    BEFORE UPDATE ON log_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-set position for session_tasks
CREATE OR REPLACE FUNCTION set_session_task_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position = 0 THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM session_tasks
        WHERE session_id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_session_task_position
    BEFORE INSERT ON session_tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_session_task_position();

-- Auto-set position for log_types
CREATE OR REPLACE FUNCTION set_log_type_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position = 0 THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM log_types
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_log_type_position
    BEFORE INSERT ON log_types
    FOR EACH ROW
    EXECUTE FUNCTION set_log_type_position();

-- =============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================================================

-- Function to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );

    -- Seed default log types for focus sessions
    INSERT INTO public.log_types (user_id, name, input_type, config, is_default, position) VALUES
        (NEW.id, 'Mood', 'numeric_scale', '{"min": 1, "max": 5, "min_label": "Low", "max_label": "High"}', true, 1),
        (NEW.id, 'Energy', 'numeric_scale', '{"min": 1, "max": 5, "min_label": "Low", "max_label": "High"}', true, 2),
        (NEW.id, 'Notes', 'text', '{}', true, 3);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function on new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only manage their own profile
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" ON profiles
    FOR DELETE USING (auth.uid() = id);

-- Projects: users can only manage their own projects
CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Items: users can only manage their own items
CREATE POLICY "Users can view their own items" ON items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own items" ON items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" ON items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" ON items
    FOR DELETE USING (auth.uid() = user_id);

-- Time entries: users can only manage their own time entries
CREATE POLICY "Users can view their own time entries" ON time_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time entries" ON time_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries" ON time_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries" ON time_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Focus sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own focus sessions" ON focus_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus sessions" ON focus_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus sessions" ON focus_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus sessions" ON focus_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Session tasks (via session ownership)
ALTER TABLE session_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own session tasks" ON session_tasks
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM focus_sessions WHERE id = session_tasks.session_id AND user_id = auth.uid()
    ));
CREATE POLICY "Users can create their own session tasks" ON session_tasks
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM focus_sessions WHERE id = session_tasks.session_id AND user_id = auth.uid()
    ));
CREATE POLICY "Users can update their own session tasks" ON session_tasks
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM focus_sessions WHERE id = session_tasks.session_id AND user_id = auth.uid()
    ));
CREATE POLICY "Users can delete their own session tasks" ON session_tasks
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM focus_sessions WHERE id = session_tasks.session_id AND user_id = auth.uid()
    ));

-- Session templates
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own session templates" ON session_templates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own session templates" ON session_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own session templates" ON session_templates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own session templates" ON session_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own reminders" ON reminders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own reminders" ON reminders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reminders" ON reminders
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reminders" ON reminders
    FOR DELETE USING (auth.uid() = user_id);

-- Log types
ALTER TABLE log_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own log types" ON log_types
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own log types" ON log_types
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own log types" ON log_types
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own log types" ON log_types
    FOR DELETE USING (auth.uid() = user_id);

-- Log entries (append-only: no update/delete)
ALTER TABLE log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own log entries" ON log_entries
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own log entries" ON log_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Session reflections
ALTER TABLE session_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own session reflections" ON session_reflections
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own session reflections" ON session_reflections
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own session reflections" ON session_reflections
    FOR UPDATE USING (auth.uid() = user_id);

-- Breaks
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own breaks" ON breaks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own breaks" ON breaks
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own breaks" ON breaks
    FOR UPDATE USING (auth.uid() = user_id);
