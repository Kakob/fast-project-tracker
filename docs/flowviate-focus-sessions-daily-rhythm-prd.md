# Flowviate PRD: Focus Sessions & Daily Rhythm

**Author:** Jacob  
**Status:** Draft  
**Priority:** High (ships with Focus Session Engine)  
**Last Updated:** April 6, 2026

---

## 1. Problem

Productivity tools track *what* you do but ignore *why* you're doing it and *how* you felt doing it. When motivation dips or distractions show up, a task list alone cannot help. There is no system that connects daily intentions to moment-to-moment experience during focused work.

Flowviate already has a working Task Engine with boards, lists, calendar, and table views. The Focus Session Engine and its supporting systems are the features that elevate Flowviate from a competent task manager to a differentiated product. This PRD defines those systems.

---

## 2. Target Users

**Primary:** Solo knowledge workers, indie developers, and students who struggle with sustained focus and want a tool that helps them stay aligned with their intentions while working.

**Secondary:** Anyone managing behavioral change alongside productive work (building habits, breaking habits, recovering from burnout) who wants accountability data without a separate journal app.

---

## 3. Focus Session Engine

### 3.1 Core Model

A focus session is an ordered list of tasks, each with an individual time allocation. The session's total duration is always derived from the sum of its task times — it is never a fixed, independent constraint. When tasks are added, removed, reordered, or have their time estimates changed, the session duration recalculates automatically.

**Free tier constraint:** Sessions are capped at 1 hour total. When the 1-hour mark is reached, the session ends immediately (hard cutoff). Premium users have unlimited session length.

### 3.2 Session Lifecycle

#### 3.2.1 Setup

- User selects tasks from their board, arranges them in order, and sets a time allocation for each.
- Each task has a configurable warning buffer (default: 3 minutes) that determines when the end-of-task warning fires. This is set per-task on the session-task level, not per-session.
- Sessions can be created from scratch or from a saved template (see Section 3.5).
- Reminders can be configured during setup (see Section 4).

#### 3.2.2 Active Session UI

The session UI shows the current task prominently, with a small queue of upcoming tasks visible below it. The following controls are always visible:

- **Done button** (+ keyboard shortcut `d`) — marks the current task complete and advances to the next task. Leftover time is not redistributed; the session simply ends earlier.
- **+Time button** — extends the current task's time allocation in configurable increments (+1, +5, +10, +15 minutes). Extending a task grows the overall session duration; it does not steal time from subsequent tasks. On the free tier, extensions cannot push the session past the 1-hour cap.
- **Pause/Resume button** (+ `Space`) — freezes the timer. Everything holds until resumed. See Section 3.7 for pause behavior details.
- **AI Motivation button** (floating action button, premium only) — generates a fresh motivational message based on the user's current intention and session context via the Claude API. One tap, no chat interface. User-configurable cooldown between taps. Keyboard shortcut: `m`.
- **Break button** (floating, near the AI button) — pauses the session and starts a break timer (see Section 3.4). Keyboard shortcut: `b`.

#### 3.2.3 Live Editing

During an active session, the user can:

- Add a new task to the session queue.
- Remove a task from the session queue.
- Reorder tasks in the queue.
- Change a task's time estimate. The session duration recalculates immediately.

### 3.3 Task Transitions

#### 3.3.1 Warning Zone

When the remaining time on the current task falls below the configured warning buffer, a combined visual and audio indicator fires. The visual cue is a color shift or pulse on the timer. The audio cue is a configurable chime or tone. This is informational only — it does not prompt the user for a decision or require any action.

#### 3.3.2 Task Completed Early

User taps the Done button or presses `d`. The task is marked complete. The session advances to the next task. The session's remaining duration shrinks by the unused time.

#### 3.3.3 Task Time Expires (Not Marked Done)

If the timer reaches zero and the user has not marked the task done, the following happens automatically:

- The task is paused (not killed).
- The actual time spent is logged on the task.
- The task returns to the "Doing" column on the kanban board.
- The task card shows both the original time estimate and the time already spent, so the user can see at a glance what's left.
- The session auto-advances to the next task.

#### 3.3.4 Skip

The user can press `k` at any time to skip the current task. This behaves identically to time expiry: task is paused, time is logged, task returns to "Doing," session advances. The difference is that it's intentional rather than automatic.

#### 3.3.5 Transition Animation

Between tasks, there is a brief 3–5 second pause that shows the user what's coming next before the timer starts. The outgoing task card slides out; the incoming task card slides in. This prevents jarring context switches.

### 3.4 Breaks

Between tasks, the app prompts the user to take a short break (stand up, stretch, hydrate). The break is optional and dismissible. The user can also trigger a break at any time via the floating break button or by pressing `b`.

Break timer options:

- **Popular defaults:** 1 min, 3 min, 5 min (one-tap selection).
- **Custom duration:** user types in their own value.
- **Pause-style:** user ends the break manually whenever they're ready.

During a break, the session timer is paused. Break time is tracked separately and does not count toward task time or pause time.

### 3.5 Session Templates

Users can save a session configuration as a reusable template at any point — before starting a session or after completing one. When launching a session from a template, two options are available:

- **Clone exact tasks:** Copies the same task IDs, order, and time allocations. Useful for recurring work blocks with the same tasks.
- **Clone structure only:** Copies the time block structure (number of slots, durations, order) but leaves the task slots empty for the user to fill with new tasks. Useful for routines like "morning coding block: 45 min deep work, 15 min review, 30 min admin."

Templates are private to the user in v1. The schema is designed so that export/import (JSON) can be added in a future version without migration.

### 3.6 Session End

When the last task in a session finishes, the user ends the session manually, or the free tier 1-hour cap is reached, two things happen:

1. **Auto-generated summary** is displayed, showing:
   - Tasks completed (count + list)
   - Tasks returned to "Doing" (count + list)
   - Total session duration
   - Active work time vs. pause time vs. break time
   - Time per task (allocated vs. actual)
   - Number of extensions made
   - Reminders that fired
   - Log entries captured during session
2. **Optional, dismissible reflection prompt** appears (see Section 5 for logging details). The user can fill it in or skip it.

Session data (time spent per task, completion status, extensions) is written back to the project tracker's time statistics and updates the task's cumulative time tracking data.

### 3.7 Pause Behavior

When the session is paused:

- All timers stop (task timer, session timer).
- All reminders pause at their current position in the schedule.
- When the session is resumed, reminders resume from where they left off — no reminders are skipped or doubled.
- Pause time is tracked separately from break time and active work time. All three are shown in the session summary.

---

## 4. Reminder System

Reminders are messages that surface during a focus session to keep the user grounded, motivated, or on track. They are configured by the user and delivered according to rules the user defines.

### 4.1 Reminder Sources

A reminder can originate from one of three places. All three surface identically during a session — the source only determines where the reminder was created and what scope it applies to.

| Source | Where It Lives | When It Surfaces | Example |
|--------|---------------|-----------------|---------|
| **Global** | User settings (account-level) | Every session, regardless of which tasks are active | "I'm building toward my career. Stay focused." |
| **Task-level** | On a specific task card (intention field) | Only when that task is the active task in a session | "This feature is what makes the demo pop." |
| **Session-level** | Created during session setup or live during a session | Only during that specific session | "No phone for the next 2 hours." |

### 4.2 Trigger Types

Each reminder has a trigger configuration that determines when it fires. Three trigger types are supported, and they can be combined:

| Trigger Type | How It Works | Example |
|-------------|-------------|---------|
| **Interval** | Fires repeatedly at a fixed time interval (every X minutes) | "Hydrate" every 20 minutes |
| **Moment** | Fires at a specific point in the task or session lifecycle: start, halfway, end, or a custom percentage | "Remember your intention" at the start of each task |
| **Manual placement** | User places the reminder at a specific timestamp on a visual timeline during session setup | A motivation message at the 45-minute mark of a 90-minute session |

### 4.3 Delivery

Each reminder has a configurable delivery method:

- **Visual only** — a toast notification that appears and auto-dismisses.
- **Audio only** — a TTS reading of the reminder text (via Web Speech API) or a user-recorded audio clip.
- **Visual + audio** — both simultaneously.

### 4.4 Live Editing

Reminders are fully editable during an active session. The user can add new reminders, edit existing ones, change trigger configurations, or delete reminders without pausing the session. The reminder schedule recalculates on any change.

### 4.5 Log-Triggering Reminders

A reminder can optionally be configured to prompt a log entry when it fires. For example, a reminder that fires every 30 minutes could include a mood check-in prompt. This is opt-in per reminder — the user sets it up if they want it, but it is never forced. See Section 5 for the logging system.

---

## 5. Logging System (Daily Rhythm)

The logging system allows users to capture structured data about their experience during focus sessions. All logs are tied to a session — there is no standalone journaling feature. Logging is always optional and never blocks the session flow.

### 5.1 Log Type Builder

Users define their own log types. Each log type has a name and an input type. The system ships with a few defaults, but users can create, edit, and delete custom log types at any time. Custom log types are a premium feature; free users have access to the default types only.

| Input Type | Configuration | Example Log Type |
|-----------|--------------|-----------------|
| **Numeric scale** | Min value, max value, optional labels for endpoints | "Energy" (1–5, labeled Low to High) |
| **Text** | Free-form text input | "Notes" (open-ended) |
| **Multiple choice** | User-defined list of options | "Focus quality" (Deep / Shallow / Distracted) |

**Default log types (shipped with the app):**

- Mood (numeric scale, 1–5)
- Energy (numeric scale, 1–5)
- Notes (text)

Users can delete or modify these defaults and add any custom log types they want (premium).

### 5.2 When Logging Happens

- **On demand:** the user can log at any time during a session via a quick-access button or by pressing `l`. This opens a prompt with their configured log types.
- **Reminder-triggered:** a reminder can optionally prompt a specific log type when it fires (see Section 4.5).
- **Session end:** the optional reflection prompt at session end can include log entry fields.

### 5.3 Log Data and Analytics

All log entries are stored with a timestamp and linked to the session and active task at the time of logging. In v1, log data is viewable in a simple chronological list per session. In v2, numeric log data feeds into trend charts and analytics alongside time tracking statistics.

---

## 6. AI Motivation (Premium)

A floating action button is visible during all active sessions for premium users. When tapped (or `m` is pressed), it sends the following context to the Claude API and displays the generated response as a brief, styled overlay:

- The user's global intentions (reminders with source_type = global).
- The current task's intention field.
- Any session-level reminders.
- Time elapsed and remaining in the current task.
- Recent log entries from this session (mood, energy, notes).

The AI generates a short, fresh motivational message grounded in the user's own words and context. It is not a chatbot — there is no back-and-forth. One tap, one message, then the user returns to work.

The cooldown between taps is configurable by the user (e.g., no cooldown, 30 seconds, 1 minute, 5 minutes).

---

## 7. Time Statistics

Session data feeds into the project tracker's statistics at two levels:

### 7.1 Per-Task Statistics

- **Total time spent** (cumulative across all sessions)
- **Session count** (how many sessions this task has been part of)
- **Average time per session** (for this task)
- **Original estimate vs. actual** (shows accuracy of time estimation over time)

### 7.2 Per-Project Statistics

- **Total time across all tasks** in the project
- **Most worked-on tasks** (ranked by cumulative time)
- **Time trend** (time spent per day/week on this project)

---

## 8. Keyboard Shortcuts

Focus session mode adds its own shortcuts. These do not conflict with existing global or view-specific shortcuts. Existing shortcuts remain functional — session shortcuts are additive, not replacements. Shortcuts are not customizable in v1 (v2 feature).

### 8.1 Existing Shortcuts (Unchanged)

**Global (all views)**

| Key | Action |
|-----|--------|
| `n` | Focus quick-add input |
| `?` | Toggle shortcuts help panel |
| `1–5` | Switch view (Board / List / Calendar / Projects / Archive) |
| `t` | Start/stop timer on focused item |

**List View:** `↑/↓` navigate, `Enter` expand/collapse, `→` open details, `←` close details, `e` edit title.

**Board View:** `↑/↓` navigate cards, `→/Enter` open details, `←` close details.

**Calendar View:** `↑/↓` navigate, `→/Enter` open details, `←` close details, `[/]` prev/next month, `t` go to today.

**Projects View:** `↑/↓` navigate, `Enter` expand/collapse, `→` open details, `←` close details, `s` add subtask, `t` add task to project.

**Archive View:** `↑/↓` navigate, `→/Enter` open details, `←` close details.

**Details Panel:** `Escape` close panel.

### 8.2 Focus Session Shortcuts (New)

These are active only during a focus session:

| Key | Action |
|-----|--------|
| `Space` | Pause / resume session |
| `d` | Mark current task done, advance |
| `k` | Skip current task (→ Doing), advance |
| `b` | Take a break |
| `m` | AI motivation (premium) |
| `l` | Open log prompt |
| `+` or `=` | Extend current task time (+default increment) |
| `Esc` | End session (with confirmation) |
| `?` | Shortcuts help (same as global) |

---

## 9. Free / Premium Tier Split

| Feature | Free | Premium |
|---------|------|---------|
| Focus sessions | ✓ (1-hour cap, hard cutoff) | ✓ (unlimited) |
| Session templates | ✓ | ✓ |
| Reminders (all sources, all triggers) | ✓ | ✓ |
| Default log types (Mood, Energy, Notes) | ✓ | ✓ |
| Custom log types (log type builder) | ✗ | ✓ |
| AI motivation button | ✗ | ✓ |
| Live session editing | ✓ | ✓ |
| Breaks | ✓ | ✓ |
| Session summary + reflection | ✓ | ✓ |
| Time statistics (per-task + per-project) | ✓ | ✓ |

---

## 10. Data Model

All tables use UUID primary keys, timestamptz for timestamps, and are scoped by user_id with Supabase Row-Level Security policies enforcing `user_id = auth.uid()`. The schema below extends the existing `users`, `projects`, and `tasks` tables.

### 10.1 Modified Tables

#### tasks (add columns)

```sql
intention              text        nullable    -- the "why" behind this task
cumulative_time_ms     bigint      default 0   -- total time spent across all sessions
session_count          int         default 0   -- number of sessions this task has been in
```

#### users (add columns)

```sql
default_warning_buffer_sec   int      default 180    -- default 3 min
default_break_duration_sec   int      default 180    -- default 3 min
preferred_time_increments    int[]    default '{1,5,10,15}'
ai_motivation_cooldown_sec   int      default 0      -- 0 = no cooldown
tier                         text     default 'free'  CHECK (tier IN ('free','premium'))
```

### 10.2 New Tables

#### focus_sessions

```sql
id                  uuid        PK, default gen_random_uuid()
user_id             uuid        FK → users, NOT NULL
status              text        NOT NULL, CHECK (status IN
                                  ('setup','active','paused','completed','abandoned'))
started_at          timestamptz nullable    -- set when status → active
paused_at           timestamptz nullable    -- set when status → paused
completed_at        timestamptz nullable    -- set when status → completed
total_pause_ms      bigint      default 0   -- accumulated pause time
total_break_ms      bigint      default 0   -- accumulated break time
total_active_ms     bigint      default 0   -- accumulated active work time
template_id         uuid        FK → session_templates, nullable
ended_by            text        nullable, CHECK (ended_by IN
                                  ('completed','abandoned','free_tier_cap'))
created_at          timestamptz default now()
updated_at          timestamptz default now()
```

#### session_tasks

Join table linking tasks to sessions. This is the core of the session's structure.

```sql
id                  uuid        PK, default gen_random_uuid()
session_id          uuid        FK → focus_sessions, NOT NULL, ON DELETE CASCADE
task_id             uuid        FK → tasks, NOT NULL
position            int         NOT NULL    -- ordering within the session
allocated_time_ms   bigint      NOT NULL    -- planned time for this task
actual_time_ms      bigint      default 0   -- actual time spent
warning_buffer_sec  int         default 180 -- per-task warning buffer
status              text        NOT NULL, CHECK (status IN
                                  ('pending','active','completed','paused_incomplete','skipped'))
started_at          timestamptz nullable
completed_at        timestamptz nullable
extensions_ms       bigint      default 0   -- total time added via +time
extension_count     int         default 0   -- number of times extended

UNIQUE (session_id, position)
UNIQUE (session_id, task_id)
```

#### session_templates

```sql
id                  uuid        PK, default gen_random_uuid()
user_id             uuid        FK → users, NOT NULL
name                text        NOT NULL
description         text        nullable
template_data       jsonb       NOT NULL
    -- Structure:
    -- {
    --   slots: [
    --     { task_id: uuid | null,       -- null for structure-only
    --       allocated_time_ms: bigint,
    --       warning_buffer_sec: int,
    --       position: int }
    --   ]
    -- }
created_at          timestamptz default now()
updated_at          timestamptz default now()
```

#### reminders

Unified reminder table. The source_type and source_id fields determine where the reminder came from.

```sql
id                  uuid        PK, default gen_random_uuid()
user_id             uuid        FK → users, NOT NULL
content             text        NOT NULL    -- the reminder message
source_type         text        NOT NULL, CHECK (source_type IN
                                  ('global','task','session'))
source_id           uuid        nullable    -- FK to tasks or focus_sessions
                                            -- null for global reminders
delivery            text        NOT NULL, CHECK (delivery IN
                                  ('visual','audio','both')), default 'visual'
audio_url           text        nullable    -- Supabase Storage path for recorded audio

-- Trigger configuration
trigger_type        text        NOT NULL, CHECK (trigger_type IN
                                  ('interval','moment','manual'))
trigger_interval_ms bigint      nullable    -- for interval: every X ms
trigger_moment      text        nullable    -- for moment: 'start','halfway',
                                            --   'end', or decimal like '0.75'
trigger_timestamp_ms bigint     nullable    -- for manual: ms offset from
                                            --   session or task start

-- Optional: trigger a log prompt
triggers_log_type_id uuid       FK → log_types, nullable

is_active           boolean     default true
created_at          timestamptz default now()
updated_at          timestamptz default now()
```

#### log_types

User-defined log type definitions (the form builder).

```sql
id                  uuid        PK, default gen_random_uuid()
user_id             uuid        FK → users, NOT NULL
name                text        NOT NULL    -- e.g., "Mood", "Energy"
input_type          text        NOT NULL, CHECK (input_type IN
                                  ('numeric_scale','text','multiple_choice'))
config              jsonb       NOT NULL    -- type-specific configuration:
    -- numeric_scale: { min: 1, max: 5, min_label: "Low", max_label: "High" }
    -- text: {}
    -- multiple_choice: { options: ["None", "Mild", "Strong"] }
is_default          boolean     default false  -- shipped defaults
is_custom           boolean     default false  -- user-created (premium only)
position            int         NOT NULL       -- display ordering
created_at          timestamptz default now()
updated_at          timestamptz default now()

UNIQUE (user_id, name)
```

#### log_entries

Append-only table. No updates, only inserts. Keeps the write path fast.

```sql
id                  uuid        PK, default gen_random_uuid()
user_id             uuid        FK → users, NOT NULL
session_id          uuid        FK → focus_sessions, NOT NULL
session_task_id     uuid        FK → session_tasks, nullable
                                            -- which task was active when logged
log_type_id         uuid        FK → log_types, NOT NULL
value_numeric       numeric     nullable    -- for numeric_scale
value_text          text        nullable    -- for text
value_choice        text        nullable    -- for multiple_choice (selected option)
source              text        NOT NULL, CHECK (source IN
                                  ('manual','reminder_prompt','session_end'))
created_at          timestamptz default now()
```

#### session_reflections

The optional reflection captured at session end. Separate from log_entries because it is a structured summary, not a point-in-time entry.

```sql
id                  uuid        PK, default gen_random_uuid()
session_id          uuid        FK → focus_sessions, UNIQUE, NOT NULL
user_id             uuid        FK → users, NOT NULL
how_it_went         int         nullable, CHECK (how_it_went BETWEEN 1 AND 5)
wins                text        nullable
friction            text        nullable
notes               text        nullable
created_at          timestamptz default now()
```

#### breaks

Tracks breaks taken during a session, whether between tasks or user-initiated.

```sql
id                  uuid        PK, default gen_random_uuid()
session_id          uuid        FK → focus_sessions, NOT NULL
user_id             uuid        FK → users, NOT NULL
started_at          timestamptz NOT NULL
ended_at            timestamptz nullable
planned_duration_sec int        nullable    -- null if user chose pause-style
break_type          text        NOT NULL, CHECK (break_type IN
                                  ('between_tasks','manual'))
created_at          timestamptz default now()
```

### 10.3 Indexes

```sql
-- Core lookups
CREATE INDEX idx_focus_sessions_user_status ON focus_sessions(user_id, status);
CREATE INDEX idx_session_tasks_session ON session_tasks(session_id, position);
CREATE INDEX idx_reminders_source ON reminders(source_type, source_id);
CREATE INDEX idx_reminders_user_active ON reminders(user_id) WHERE is_active = true;
CREATE INDEX idx_log_entries_session ON log_entries(session_id, created_at);
CREATE INDEX idx_log_entries_user_type ON log_entries(user_id, log_type_id, created_at);
CREATE INDEX idx_breaks_session ON breaks(session_id);
CREATE INDEX idx_session_templates_user ON session_templates(user_id);
```

### 10.4 Entity Relationship Summary

```
users
  │
  ├── focus_sessions (1:many)
  │     ├── session_tasks (1:many) ──── tasks (many:1)
  │     ├── log_entries (1:many) ─────── log_types (many:1)
  │     ├── session_reflections (1:1)
  │     └── breaks (1:many)
  │
  ├── reminders (1:many)
  │     source_type: global  → source_id = null
  │     source_type: task    → source_id = tasks.id
  │     source_type: session → source_id = focus_sessions.id
  │
  ├── log_types (1:many)
  └── session_templates (1:many)
```

---

## 11. Integration with Existing Systems

| System | Integration Point |
|--------|------------------|
| **Task Engine (boards, kanban)** | Tasks are selected from the board into sessions. When a task's time expires without being marked done, it returns to the "Doing" column with both original estimate and time spent visible. Completed tasks move to "Done." Task's `cumulative_time_ms` and `session_count` are updated after each session. |
| **Time Tracking** | Time tracking is a byproduct of focus sessions. When a task is active in a session, the clock runs. Actual time spent is logged on `session_tasks.actual_time_ms` and rolled up to `tasks.cumulative_time_ms`. No separate stopwatch needed. |
| **Project Statistics** | Per-task stats: total time, session count, avg time per session, original estimate vs actual. Per-project stats: total time across all tasks, most worked-on tasks, time trend (per day/week). |
| **AI Layer (Claude API)** | On-demand motivation via floating action button (premium). v2: AI-generated session summaries, pattern detection across log data, suggested reminders. |

---

## 12. Scope & Phasing

### v1: Ship with Focus Session Engine

- Focus session lifecycle: setup, active, pause, complete, abandon.
- Free tier 1-hour hard cap.
- Session tasks: ordering, time allocation, live editing, auto-advance with 3–5 sec transition.
- Warning zone: visual + audio indicator at configurable per-task buffer (default 3 min).
- Done / +Time / Skip / Pause controls with keyboard shortcuts.
- Tasks returned to "Doing" show original estimate + time already spent.
- Breaks: between-task prompts + manual break button with popular defaults (1/3/5 min), custom duration, and pause-style.
- Session templates: save before or after, clone exact or structure-only. Private only, schema ready for export/import.
- Reminder system: three sources (global, task, session), three trigger types (interval, moment, manual placement), visual/audio/both delivery, live editing.
- Default log types: Mood, Energy, Notes. Log entries during sessions: manual, reminder-triggered, session-end.
- Session end: auto-generated summary (tasks completed, tasks returned to Doing, total duration, active/pause/break time breakdown, time per task allocated vs actual, extensions, reminders fired, log entries) + optional reflection.
- Session data writes back to per-task and per-project time statistics.
- Keyboard shortcuts for all session actions (non-conflicting with existing shortcuts).
- Pause behavior: all timers and reminders freeze, resume from where they left off. Pause time tracked separately.

### v1.5: Fast Follow

- AI motivation button (Claude API integration, premium).
- Custom log types via log type builder (premium).
- Log-triggering reminders.
- Reminder timeline visual editor for manual placement.
- Session history view: browse past sessions with summaries.

### v2: AI-Powered

- AI-generated session summaries (replace rule-based).
- Trend charts for numeric log data over time.
- Pattern detection across sessions ("you're most productive when you set intentions").
- AI-suggested reminders based on past reflections.
- Natural language log search.
- Customizable keyboard shortcuts.

---

## 13. Non-Goals (v1)

- Social or shared sessions (no multi-user collaboration).
- Integration with health apps (Apple Health, Fitbit).
- Gamification beyond session completion data (no points, badges, leaderboards).
- Push notifications (v1 relies on in-app prompts only).
- Standalone logging outside of sessions.
- Mobile companion app (responsive web design is acceptable for v1).
- Shareable/exportable session templates.

---

## 14. Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Sessions started per active user per week | >3 | Indicates the feature is part of their workflow |
| Session completion rate | >60% | Completed vs. abandoned |
| Avg tasks completed per session | >1.5 | Sessions are used for real work |
| Reflection completion rate | >30% | Optional, so lower bar |
| Log entries per session (among users with custom log types) | >1 | Users who set up logs are actually using them |
| 7-day retention lift | +15% | Compared to users not using focus sessions |

---

## 15. Resolved Design Decisions

These were open questions that have been answered during the design process:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Warning buffer scope | Per-task only (on session_tasks, not session-level) | Keep it simple. Different tasks have different urgency. |
| Extension cap | Free: 1-hour session cap (hard cutoff). Premium: unlimited. | Monetization lever + prevents runaway sessions on free tier. |
| Task returning to "Doing" | Show both original estimate and time already spent | User can see at a glance how much was done and what's left. |
| Session templates sharing | Not in v1. Schema designed for easy export/import later. | Scope control. Template_data as JSONB is already portable. |
| AI motivation cooldown | User-configurable (0 sec to 5 min) | Gives user control over their own API cost exposure. |
| Pause behavior | All timers + reminders freeze. Resume from exact position. Pause time tracked separately. | Clean mental model. No lost or doubled reminders. |
| Keyboard shortcuts in session | Additive, non-conflicting. No repurposing of existing shortcuts. | Avoids confusion between modes. |
| Leftover time on early completion | Session ends earlier. No redistribution. | Simple, predictable behavior. |
| Time extension mechanics | Grows the whole session. Does not steal from other tasks. | Respects the user's original plan for other tasks. |
| Auto-advance default | Task paused, time logged, returns to "Doing," session advances | No clicking required. Session keeps moving. |
| Standalone logging | Not supported. All logs tied to sessions. | Keeps the app focused on productivity, not journaling. |
| Free/premium split | Free: 1hr sessions, default log types, no AI. Premium: unlimited sessions, custom logs, AI motivation. | Core experience is free. Power features and AI are premium. |

---

## 16. Interview Talking Points

This feature set demonstrates:

- **Product thinking:** Identifying an emotional and behavioral need adjacent to the core task management problem, and designing an integrated system around it rather than bolting on a journal.
- **Data modeling:** Relational schema linking sessions to tasks to logs to reminders, with a polymorphic reminder source pattern and a user-defined log type builder (essentially a lightweight form builder). Append-only log_entries for fast writes. JSONB for flexible template and log type configuration.
- **Real-time UX design:** Client-side timer management, live session editing without page reloads, non-blocking prompts, fluid task transitions with animation, and a pause/resume system that preserves reminder state.
- **API integration:** Context-aware AI motivation using the Claude API with intentional prompt design (sending only relevant context, not the entire session history). User-configurable rate limiting.
- **Incremental architecture:** v1 is entirely rule-based and self-contained. v2 layers AI on top without requiring a schema rewrite. The log_types table is extensible without migrations. Templates are ready for sharing without schema changes.
- **Monetization design:** Free tier is genuinely useful (full session functionality with a time cap). Premium gates power features (AI, custom logs, unlimited sessions) rather than crippling the core experience.
- **UX sensitivity:** Non-blocking interactions throughout. Warning zones inform without interrupting. Auto-advance keeps flow. Logging is always optional. The session adapts to the user, not the other way around.
