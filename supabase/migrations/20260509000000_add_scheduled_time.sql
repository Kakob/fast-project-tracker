-- Migration: Add scheduling fields for week-view calendar
-- Adds an exact start timestamp + duration so tasks can be placed in
-- hourly/5-minute slots, distinct from due_date (a soft deadline).

ALTER TABLE items
    ADD COLUMN scheduled_start TIMESTAMPTZ,
    ADD COLUMN duration_minutes INT NOT NULL DEFAULT 30
        CHECK (duration_minutes > 0);

CREATE INDEX idx_items_user_scheduled ON items(user_id, scheduled_start)
    WHERE scheduled_start IS NOT NULL;
