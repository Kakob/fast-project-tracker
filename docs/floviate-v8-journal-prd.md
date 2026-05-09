# Floviate v8: Journal — Product Requirements Document

**Status:** Draft
**Owner:** Jacob
**Last updated:** April 26, 2026
**Scope:** v8 feature — dedicated page within Floviate

---

## 1. Summary

Journal is a document-first writing surface within Floviate where any line or paragraph can be promoted to a task. It replaces the pattern of stranded `TODO.md`, `THOUGHTS.md`, and `NOTES.md` files that accumulate in repositories and other working directories — files that are simultaneously planning artifacts, freeform thinking, and task lists, and which fit cleanly into neither traditional task managers (too structured) nor notes apps (no task primitive).

Journal lives on a dedicated page in the Floviate sidebar, alongside Focus Sessions and Daily Rhythm. It shares Floviate's existing client-side AES-GCM encryption architecture and integrates with the Focus Session Engine and Daily Rhythm log.

---

## 2. Problem & Motivation

### 2.1 The pattern being addressed

Engineers, designers, and knowledge workers consistently produce hybrid documents that are part journal, part task list, part architectural reasoning. These files exist because:

- Task managers force atomization (title, due date, status) before the user has finished thinking.
- Notes apps treat tasks as second-class — buried inside prose with no aggregation, no completion state, no surfacing.
- Engineers default to markdown files in repos because the friction is zero and the format is honest about the hybrid nature of the content.

The cost of this pattern: those files don't belong in repos (not version-controllable in a meaningful sense, not shareable, not surfaceable across projects), they get stranded from each other, and no tool aggregates the tasks living inside them.

### 2.2 Why existing tools fail

- **Notion / Obsidian:** Force information architecture decisions before writing. Heavy. Cross-document task aggregation is bolted on, not native.
- **Todoist / Things / Linear:** Tasks are atoms. Notes are a description field. The journaling flow is impossible.
- **Apple Notes / Bear:** Strong writing surface, no task primitive worth using.
- **Markdown files in repos:** Honest about the hybrid nature, but stranded — no search, no aggregation, no encryption, no integration with focus sessions or daily rhythm.

### 2.3 Floviate's wedge

Floviate already has a Focus Session Engine and Daily Rhythm log. Adding Journal makes these primitives more coherent: a focus session can be tied to a task that lives inside a journal entry; a Daily Rhythm log entry is a short-form journal entry. Storage, encryption, and search are unified.

---

## 3. Goals & Non-Goals

### 3.1 Goals

- **G1.** Provide a low-friction writing surface where the user can dump prose without making structural decisions.
- **G2.** Allow any line or paragraph in a journal entry to be promoted to a task in-place.
- **G3.** Aggregate tasks across all journal entries into a single global task view.
- **G4.** Preserve completed prose — completion flips a checkbox, never deletes or hides the entry text.
- **G5.** Support project-filtered views via tags, without forcing the user to create or pick a project at write time.
- **G6.** Integrate with existing Focus Session Engine (a session can be tied to a task) and Daily Rhythm (Daily Rhythm entries appear in the journal stream as a special entry type).
- **G7.** Maintain the existing client-side AES-GCM encryption guarantee — entries and tasks are encrypted at rest, decrypted lazily on the client.

### 3.2 Non-goals (v8)

- **N1.** Rich formatting beyond basic markdown (no embedded media, tables, drawings).
- **N2.** Document-to-document linking / backlinks / graph view (deferred to v9+).
- **N3.** Real-time collaboration or sharing.
- **N4.** Mobile app parity (web-first; mobile is read + quick-add only).
- **N5.** AI synthesis features (pattern detection, weekly summaries, prose-to-task extraction). Deferred — likely a premium-tier feature.
- **N6.** Calendar / external task system sync (GitHub Issues, Linear, etc.). Deferred.
- **N7.** Multiple separate journals. One unified stream with tag-based filtering (see §5.3).

---

## 4. Users & Use Cases

### 4.1 Primary user

A solo engineer, designer, or knowledge worker who:
- Already produces hybrid markdown files as part of their workflow.
- Values low friction over rich features.
- Works across multiple projects and contexts but doesn't want to manage a project hierarchy.
- Wants their tasks and thinking to live in one searchable, encrypted place.

### 4.2 Use cases

- **UC1. Project planning dump.** User opens a fresh entry, writes 400 words about an architectural decision, marks three sentences as tasks, closes the entry. Tasks appear in the global task view tagged with the project.
- **UC2. Quick task capture.** User uses a keyboard shortcut to open a quick-add modal, types `- [ ] Email Benji about the YouTube role`, hits enter. Task is created, attached to today's daily entry.
- **UC3. Daily reflection.** User reviews their Daily Rhythm log entry for the day, journals a paragraph reflecting on a focus session, marks one follow-up as a task.
- **UC4. Context retrieval.** Two weeks later, user searches "auth flow" and gets every entry that mentions it across all projects, in chronological order.
- **UC5. Project review.** User filters the journal stream to `#floviate` and reads every entry tagged with the project, treating it as a project journal.

---

## 5. Functional Requirements

### 5.1 Document model

- **FR-1.1.** A journal entry is a markdown text document with the following fields:
  - `id` (UUID)
  - `created_at`, `updated_at` (timestamps)
  - `title` (optional string; auto-suggested if absent — see FR-1.3)
  - `body` (markdown text, encrypted)
  - `tags` (array of strings)
  - `entry_type` (enum: `freeform`, `daily_rhythm`, `focus_session_note`)
  - `linked_session_id` (optional, references a Focus Session)
- **FR-1.2.** Entries are append-only by default; edits are allowed but versioning is deferred to v9.
- **FR-1.3.** **Title behavior:**
  - If the entry is under 200 characters, no title is required; the entry surfaces in lists by its first line, truncated.
  - If the entry exceeds 200 characters and the user has not provided a title, prompt for one on save (skippable; default to first line).
  - If the entry begins with a markdown `# Heading`, use that as the title automatically and don't prompt.

### 5.2 Task promotion

- **FR-2.1.** Any line in the body can be marked as a task. Three mechanisms:
  - **Markdown syntax:** A line starting with `- [ ]` is automatically a task. `- [x]` is a completed task.
  - **Slash command:** `/task` at the start of a line converts the current line/paragraph to a task.
  - **Selection shortcut:** Select text + `Cmd/Ctrl+Shift+T` wraps the selection as a task.
- **FR-2.2.** A task is rendered inline as a checkbox + the line text. Completion is bidirectional: checking the box in the entry flips the task's status; checking it in the global task view does the same.
- **FR-2.3.** A task has the following derived fields:
  - `task_id` (UUID, generated on promotion)
  - `entry_id` (the parent entry)
  - `position` (offset in the body)
  - `body` (the prose of the line, used as the task description)
  - `status` (`open` | `done`)
  - `completed_at` (optional)
  - `tags` (inherited from entry; can be overridden — see FR-2.5)
- **FR-2.4.** Completing a task does not delete or hide the line. The prose stays; only the checkbox state changes.
- **FR-2.5.** Tasks inherit tags from their parent entry. Inline tag overrides (e.g., `- [ ] Email Benji #urgent`) add tags to the task without affecting the entry.

### 5.3 Tags & filtering

- **FR-3.1.** Tags are inline `#tagname` strings in the entry body, parsed at save time. No separate tag management UI in v8.
- **FR-3.2.** Entries can have unlimited tags. Tags are case-insensitive and normalized to lowercase.
- **FR-3.3.** The journal stream supports filter views:
  - All entries (default)
  - Filter by tag(s) — multiple tags AND'd together
  - Filter by date range
  - Filter by entry type
- **FR-3.4.** A "project view" is just a saved filter on a tag (e.g., a pinned `#floviate` view). No separate "project" entity in v8.

### 5.4 Global task view

- **FR-4.1.** Dedicated tab on the Journal page: "Tasks."
- **FR-4.2.** Lists all open tasks across all entries, default sort: most recently created.
- **FR-4.3.** Each task row shows:
  - Checkbox (toggleable)
  - Task body (prose)
  - Source entry title or first line + date
  - Tags
  - Click-through to the source entry, scroll-anchored to the task line.
- **FR-4.4.** Filter controls match §5.3 (tags, date range, entry type) plus task-specific filters: `open`, `done`, `all`.
- **FR-4.5.** Bulk operations: mark complete, delete (deletes the task atom, not the prose line — line reverts to plain text).

### 5.5 Quick-add

- **FR-5.1.** Global keyboard shortcut (default `Cmd/Ctrl+Shift+J`) opens a quick-add modal from any page in Floviate.
- **FR-5.2.** Quick-add accepts free text. If the text starts with `- [ ]` or `/task`, it's saved as a task in today's daily entry.
- **FR-5.3.** Otherwise it's appended as a new line to today's daily entry (a freeform entry auto-created per day, separate from Daily Rhythm).

### 5.6 Daily Rhythm integration

- **FR-6.1.** Daily Rhythm log entries appear in the journal stream as `entry_type: daily_rhythm` with a distinct visual treatment.
- **FR-6.2.** Daily Rhythm entries support inline task promotion via the same mechanisms as freeform entries.
- **FR-6.3.** Tasks created from Daily Rhythm entries are tagged automatically with `#daily-rhythm`.

### 5.7 Focus Session integration

- **FR-7.1.** A focus session can be linked to a task via the existing session-start UI (extended with a "link to task" picker).
- **FR-7.2.** When a focus session ends, the user is prompted to add a session note. Adding one creates an entry of type `focus_session_note` linked to the session via `linked_session_id`.
- **FR-7.3.** The linked task appears in the focus session UI; completing the task from there marks the session's primary task as done.

### 5.8 Search

- **FR-8.1.** Full-text search across all entries and tasks. Client-side after decryption.
- **FR-8.2.** Search is incremental (results update as the user types).
- **FR-8.3.** Search results highlight matched terms and link to the source entry.

---

## 6. Non-Functional Requirements

### 6.1 Encryption

- **NFR-1.1.** All entry `body`, `title`, and task `body` fields encrypted with AES-GCM client-side, using the existing Floviate key derivation.
- **NFR-1.2.** The task index (mapping task_id → entry_id, status, timestamps) is also encrypted client-side. Server stores ciphertext only.
- **NFR-1.3.** Tags are encrypted but indexed in a way that allows tag filtering without full decryption (e.g., HMAC of normalized tag value as the queryable key).

### 6.2 Performance

- **NFR-2.1.** Opening the Journal page renders the most recent 50 entries within 500ms after decryption keys are available.
- **NFR-2.2.** Task aggregation across 1,000+ entries completes within 1 second on a baseline laptop (M1 / equivalent).
- **NFR-2.3.** Quick-add modal is interactive within 100ms of shortcut invocation.

### 6.3 Reliability

- **NFR-3.1.** Entries autosave every 5 seconds during active editing and on blur.
- **NFR-3.2.** Local-first: all entries and tasks remain readable and editable when offline; sync resumes on reconnect.
- **NFR-3.3.** Conflict resolution: last-write-wins per field, with a visible "edited on another device" indicator if the server detects divergence.

### 6.4 Accessibility

- **NFR-4.1.** Full keyboard navigation: open quick-add, navigate entries, promote line to task, complete task, search.
- **NFR-4.2.** Screen reader support for the task list and entry view.
- **NFR-4.3.** Respects `prefers-reduced-motion` and `prefers-color-scheme`.

---

## 7. Data Model (SQL — additions to existing schema)

```sql
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('freeform', 'daily_rhythm', 'focus_session_note')),
    linked_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL,

    -- Encrypted fields (AES-GCM ciphertext, base64)
    title_ciphertext TEXT,
    title_iv TEXT,
    body_ciphertext TEXT NOT NULL,
    body_iv TEXT NOT NULL,

    -- Tag index (HMAC of normalized tag, queryable without decryption)
    tag_hashes TEXT[] NOT NULL DEFAULT '{}',

    -- Soft delete
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_journal_entries_user_created ON journal_entries (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_tags ON journal_entries USING GIN (tag_hashes) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_session ON journal_entries (linked_session_id) WHERE linked_session_id IS NOT NULL;

CREATE TABLE journal_tasks (
    id UUID PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('open', 'done')) DEFAULT 'open',

    -- Position within the entry body (for inline rendering and click-through)
    body_offset INTEGER NOT NULL,

    -- Encrypted fields
    body_ciphertext TEXT NOT NULL,
    body_iv TEXT NOT NULL,

    -- Tag index (inherited from entry + inline overrides)
    tag_hashes TEXT[] NOT NULL DEFAULT '{}',

    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_journal_tasks_user_status ON journal_tasks (user_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_tasks_entry ON journal_tasks (entry_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_tasks_tags ON journal_tasks USING GIN (tag_hashes) WHERE deleted_at IS NULL;
```

**Notes:**

- `tag_hashes` stores HMAC-SHA256 of the normalized tag value, keyed with a per-user secret derived from the same KDF as the encryption key. This allows server-side tag filtering without exposing tag plaintext.
- `body_offset` lets the client locate a task within an entry for click-through; if the entry is edited and offsets shift, the client reconciles on next decrypt by re-parsing the body.
- Soft delete (`deleted_at`) preserves the option to add a trash/restore feature in v9.

---

## 8. UX & Page Layout

### 8.1 Page structure

The Journal page has two primary tabs:

- **Stream** — chronological list of entries (default).
- **Tasks** — global task view across all entries.

A persistent sidebar (collapsible) shows:

- Filter controls (tags, date range, entry type).
- Pinned filter views (e.g., `#floviate`, `#job-search`).
- Quick stats: open task count, entries this week.

### 8.2 Stream view

- Single-column list of entries, most recent first.
- Each entry rendered as a card showing: title (or first line truncated), date, tag chips, first ~3 lines of body, task count if any.
- Click to expand inline (no navigation — keep the user in the stream).
- Inline task checkboxes are interactive without expanding.

### 8.3 Entry view (expanded or full-page)

- Markdown editor with live render (split mode optional, default rendered).
- Title field at top (optional).
- Tag chips at top, populated from inline `#tags` in body.
- Save state indicator ("Saved" / "Saving…").
- Keyboard shortcuts cheat sheet accessible via `?`.

### 8.4 Tasks view

- Single-column list of task rows.
- Group-by toggle: by date, by tag, by entry, flat (default flat, sorted by date).
- Filter chips at top mirroring sidebar filters.
- Inline checkbox toggles status; click on row body opens source entry.

### 8.5 Visual treatment

- Daily Rhythm entries: subtle left border or color tint to distinguish.
- Focus session notes: small icon indicator showing linked session duration.
- Completed tasks (`- [x]`): strikethrough, muted color, but prose stays visible.

---

## 9. Open Questions

- **Q1.** Should there be a "today" pinned entry that's always at the top of the stream and acts as the default target for quick-add? Leaning yes, treating it as a freeform daily entry distinct from Daily Rhythm.
- **Q2.** When a user deletes the prose line that contains a task, should the task be archived or hard-deleted? Default proposal: archive with a 30-day undo window.
- **Q3.** Tag autocomplete: should typing `#` in an entry surface an autocomplete dropdown of existing tags? Probably yes, but it's a polish item — not blocking v8.
- **Q4.** Should completed tasks remain in the global task view (filterable) or move to a separate "Done" subview? Proposal: filterable in the main view (default: hide done).
- **Q5.** Markdown subset: how strict? Proposal — support headings, bold/italic, links, code blocks, blockquotes, lists. Defer images, tables, footnotes.
- **Q6.** What's the upgrade path for users who want to import their existing `TODO.md` files? Proposal — drag-and-drop ingestion as a v8.1 follow-up; v8 ships without import.

---

## 10. Out of Scope (Future Considerations)

The following are explicitly deferred but worth flagging as natural follow-ons, especially as candidates for the premium tier:

- **AI layer:** Pattern detection across entries, weekly synthesis, prose-to-task extraction, semantic search.
- **Backlinks / graph view:** Cross-document linking and visualization.
- **External integrations:** GitHub Issues sync, calendar sync, export to other task systems.
- **Collaboration:** Shared journals or shared entries (significant encryption architecture changes required).
- **Advanced analytics:** Time-to-completion trends, tag heatmaps, focus-session-to-task correlation.
- **Versioning:** Per-entry edit history with diff view.
- **Mobile parity:** Full editor on mobile (v8 ships read + quick-add only).

---

## 11. Success Metrics

- **M1.** ≥60% of active Floviate users create at least one journal entry within 30 days of v8 launch.
- **M2.** ≥30% of journal entries contain at least one task.
- **M3.** Median time from quick-add invocation to task created ≤5 seconds.
- **M4.** ≥20% of focus sessions are linked to a task within 60 days of launch.
- **M5.** Qualitative: at least 5 unsolicited user reports of "I deleted my repo TODO.md" or equivalent within the first quarter.

---

## 12. Rollout Plan

- **Phase 1 (alpha, internal):** Core entry + task model, no integrations. Validate writing flow and task promotion mechanics.
- **Phase 2 (beta, opt-in):** Daily Rhythm + Focus Session integration. Quick-add modal. Sidebar filters.
- **Phase 3 (GA, v8 launch):** Full feature set per this PRD. Documentation + onboarding.
- **Phase 4 (v8.1, fast-follow):** Markdown file import. Tag autocomplete. Polish items from Open Questions.
