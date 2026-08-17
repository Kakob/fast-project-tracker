# Floviate — Application Atlas

A map of the app organized by **what it does**, not where files live.
Each territory links to a detailed document when one exists. Use the fog
sections in those documents as a curriculum: they are questions the repo
does not clearly answer, meant to be investigated by reading code, running
the app, or checking the hosted database.

**Evidence legend used throughout these docs:**

| Tag | Meaning |
|---|---|
| `[CODE]` | directly observed in the implementation |
| `[TEST]` | established by a test assertion |
| `[DOC]` | stated in a PRD/design doc/comment |
| `[INFERRED]` | reasonable interpretation of how code relates |
| `[UNKNOWN]` | cannot currently be established from the repo |

---

## The one-paragraph mental model

Floviate is a **fully client-side** Next.js app talking directly to hosted
Supabase (PostgREST + Auth). There is no API layer, no middleware, no
server rendering of data — security is Postgres RLS, and everything else is
React. Server state lives in a TanStack Query cache with optimistic
updates; volatile UI/session state lives in two Zustand stores; two
headless "provider" components mounted in the layout own all timers. The
product has two halves: a **task tracker** (items in five views) and a
**focus engine** (timed sessions over those items) — plus a second,
unrelated time-tracking system (ad-hoc timers), and a "daily rhythm" layer
(reminders/logging) whose schema far outruns its implementation.

```
APPLICATION
├── IDENTITY & DATA BOUNDARY
│   ├── Sign in (magic link / Google, implicit flow)
│   ├── Guard routes (client-side, cosmetic)
│   └── Enforce ownership (RLS on all 12 tables — the real boundary)
├── TASK GRAPH
│   ├── Create items (5 surfaces → one hook)
│   ├── Edit / status-cycle / archive / delete (optimistic)
│   └── Nest items (flat parent_id → client-built tree)
├── VIEWING & NAVIGATION
│   ├── Render five views over one items cache (board/list/projects/archive/calendar)
│   ├── Open the details panel (the one shared editor)
│   └── Navigate with the keyboard (7 independent listeners)
├── SCHEDULING
│   ├── Set deadlines (due_date, month calendar)
│   └── Block time (scheduled_start + duration, week view) — two unsynced axes
├── FOCUS ENGINE  ★ the differentiating feature
│   ├── Set up a session (queue tasks, allocate minutes, templates)
│   ├── Run a session (tick, warn, auto-advance, pause, break, extend)
│   ├── Finish a session (two ending paths that do NOT do the same thing)
│   └── Review (summary, reflection, save-as-template)
├── DAILY RHYTHM  (schema-complete, implementation-thin)
│   ├── Remind during sessions (interval-only, fires ~once)
│   ├── Log mood/energy/notes (append-only, session-scoped)
│   └── Reflect after sessions
└── TIME ACCOUNTING  (two systems that never meet)
    ├── Ad-hoc timers → time_entries → TimeSummary
    └── Session write-back → items.cumulative_time_ms (explicit end only)
```

---

## Territories

### Core (start here)

| Territory | One sentence | Entry points | Main modules | Status | Doc |
|---|---|---|---|---|---|
| **Run a focus session** | From "Start Session" to the summary: who ticks, who advances tasks, what survives refresh. | `SessionSetupModal.handleStart`; `FocusSessionProvider` (layout-mounted) | `focus-session-provider.tsx`, `focus-session-store.ts`, `active-session-view.tsx`, `use-focus-sessions.ts`, `use-session-tasks.ts` | Core; working but with a refresh-recovery gap and triplicated advance logic | [run-a-focus-session.md](run-a-focus-session.md) |
| **Finish a session and record work** | Two ending paths: the dialog persists everything; natural completion persists nothing (zombie sessions). | `handleEndSession` (`active-session-view.tsx:249`); 3 store-only completion sites | `use-focus-sessions.ts:153-230`, `session-summary.tsx` | Core; **contains the app's most consequential bug** and a missing DB function | [finish-a-session-and-record-work.md](finish-a-session-and-record-work.md) |
| **Create and organize tasks** | Optimistic CRUD over one flat items query; hierarchy built client-side per render. | 5 create surfaces → `use-items.ts` | `use-items.ts` (incl. `buildItemTree`), `schema.sql` items + triggers | Core; solid, best-tested area | [create-and-organize-tasks.md](create-and-organize-tasks.md) |
| **Sign in and own your data** | Client-only auth (implicit flow) with RLS as the actual security boundary. | `sign-in/page.tsx`, `auth/callback/page.tsx`, `(tracker)/layout.tsx` | `supabase-client.ts`, `auth-context.tsx`, `schema.sql` RLS | Core; working, but fragile to auth-flow drift (PKCE) and carries schema-vs-migration disagreements | [sign-in-and-own-your-data.md](sign-in-and-own-your-data.md) |

### Supporting

| Territory | One sentence | Entry points | Main modules | Status | Doc |
|---|---|---|---|---|---|
| **Navigate and select with keyboard** | Seven independent window listeners over global focus state; per-view semantics have drifted. | `tracker-layout.tsx:77` + one handler per view | all five view pages, `ui-store.ts`, `keyboard-shortcuts-help.tsx`, `item-details-panel.tsx` | Supporting; works but is the biggest duplication/collision hotspot (`t` triple-binding) | [navigate-and-select-with-keyboard.md](navigate-and-select-with-keyboard.md) |
| **Schedule work on the calendar** | Two unsynced time axes: due_date (month) vs scheduled_start+duration (week, the default). | `calendar/page.tsx`, `week-view.tsx` | week-view drag machinery, `add_scheduled_time` migration | Supporting; week view polished, month/week relationship unresolved | [schedule-work-on-the-calendar.md](schedule-work-on-the-calendar.md) |
| **Track time with ad-hoc timers** | The *other* time system: manual start/stop entries, client-enforced single-timer rule. | `TimerButton`, global `t`, `TimerProvider` | `use-time-entries.ts`, `timer/` components | Supporting; self-contained, never reconciled with focus time | [track-time-with-timers.md](track-time-with-timers.md) |
| **Remind and log during sessions** | The daily-rhythm layer: schema models the full PRD; code ships a thin slice (interval-only, fires ~once). | `reminder-setup.tsx`, provider effect, `LogPrompt` | `use-reminders.ts`, `use-log-*.ts`, `reminder-toast.tsx`, `log-prompt.tsx`, breaks | **Partially built / incomplete by design-vs-code gap** | [remind-and-log-during-sessions.md](remind-and-log-during-sessions.md) |

### Small territories (no doc; good 15–30 min exercises)

- **Quick-add an item** — `tracker-layout.tsx:64-74` → `useCreateItem` →
  watch the optimistic row settle. The smallest complete write path.
- **Archive & restore** — `board` drop zone + `archive/page.tsx`; note
  restore hardcodes `todo` and archived *children* become unreachable.
- **The details panel** — `item-details-panel.tsx`: field-by-field
  save-on-blur, its own by-id query, Tab trap, the `autoClearTitleItemId`
  handshake with week view.
- **Session templates** — save (`session-summary.tsx:62`) and load
  (`session-setup-modal.tsx:97`); find why "clone structure only" is a no-op.
- **Break lifecycle** — the two divergent endings (manual vs auto-expiry).
- **buildItemTree + its tests** — the one place with exemplary test coverage.

---

## Relationships between territories

```
Sign-in/RLS ──(gates every query in)──► all territories
Create/organize tasks ──(items are the substrate of)──► views, calendar,
                                                        sessions, timers
Run a session ──(boundaries write)──► session_tasks
              ──(explicit end writes)──► finish-a-session ──► items stats
Reminders/logging ──(fire inside)──► run-a-session's provider tick
Keyboard nav ──(shares ui-store with)──► views, details panel, timers
Calendar week-view ──(creates items via)──► create-and-organize path
Timers ──(parallel to, never joined with)──► session time accounting
```

Two cross-cutting facts to keep in mind everywhere:

1. **Everything runs in the browser.** Any invariant you care about is
   enforced either by Postgres (RLS, constraints, triggers) or by hope.
2. **The layout is the runtime.** `tracker-layout.tsx` mounts both headless
   providers, the details panel, the setup modal, and the global shortcuts —
   most "background" behavior traces back to it.

---

## Cross-cutting fog (not owned by one territory)

- ? How was the hosted database actually provisioned? Neither `schema.sql`
  (has base tables, wrong home for 4 profile columns) nor `migrations/`
  (no base tables) can build it alone. Which reflects production? [UNKNOWN]
- ? `increment_item_session_stats` is called but defined in no SQL file —
  does it exist in the hosted DB? [UNKNOWN]
- ? Root `CLAUDE.md` ("two tables", port 3000) and `supabase/config.toml`
  (project "winfeed", port 3000, Google off) both disagree with reality
  (12 tables, port 3004, hosted project). Which docs are trusted?
- ? Multi-tab behavior was never designed: sessions double-tick, timers
  double-run, edits last-write-win. Accepted for a single-user tool?
- ? `docs/architecture.md` overlaps these territory docs on mechanism
  (stores, week view, routing). Treat it as the file-oriented companion;
  where they disagree, verify in code and fix whichever is wrong.
