-- Seed data for development
-- Add test items after creating a user through the app

-- Note: This seed file is for development only.
-- In production, profiles are created when users sign up.
-- Items are created through the app UI.

/*
-- Example: After creating a test user, insert sample items:

INSERT INTO items (user_id, title, description, status, priority, due_date) VALUES
    ('actual-user-id', 'Project Alpha', 'Main project for Q1', 'in_progress', 'high', NULL),
    ('actual-user-id', 'Design mockups', 'Create UI designs', 'todo', 'medium', CURRENT_DATE + INTERVAL '7 days'),
    ('actual-user-id', 'Setup database', 'Configure Supabase tables', 'done', 'high', NULL);

-- Add child items (subtasks):
INSERT INTO items (user_id, parent_id, title, status, priority) VALUES
    ('actual-user-id', (SELECT id FROM items WHERE title = 'Design mockups'), 'Homepage wireframe', 'todo', 'medium'),
    ('actual-user-id', (SELECT id FROM items WHERE title = 'Design mockups'), 'Dashboard layout', 'todo', 'low');
*/
