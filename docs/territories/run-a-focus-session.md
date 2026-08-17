# Territory: Run a focus session

## The question

What actually happens from the moment I click "Start Session" until the session
summary appears — who ticks the clock, who decides when a task is over, and
what survives a page refresh?

## User-visible behavior

```
User opens /focus → clicks "New Focus Session"
    ↓
setup modal: pick/quick-create tasks, set minutes per task, add reminders
    ↓
click "Start Session"
    ↓
active view: current task card + countdown, task queue, controls
    ↓
timer counts up every second; warning sound/red state near time limit
    ↓
task ends (Done / Skip / time expires) → 4-second transition animation
    ↓
next task becomes active … repeat …
    ↓
last task ends → summary screen (time breakdown, per-task table, reflection)
```

Pause (Space), breaks (b), extensions (+), logging (l), and reminders can
interrupt at any point. The session keeps running if you navigate to other
views — a small indicator in the top nav shows it's live.

## Entry point

Two layers, both mounted app-wide in `web/components/tracker-layout.tsx`:

- **UI entry**: `web/app/(tracker)/focus/page.tsx` → `FocusPage`. Renders
  empty state / `ActiveSessionView` / `SessionSummary` depending on state.
- **Setup entry**: `SessionSetupModal.handleStart()`
  (`web/components/focus/session-setup-modal.tsx:118`) — the transaction-like
  sequence that creates the session. Opened via
  `useFocusSessionStore.showSetupModal`, rendered from
  `tracker-layout.tsx:204`, so it can be opened from any view. [CODE]
- **Engine entry**: `FocusSessionProvider`
  (`web/components/focus/focus-session-provider.tsx:11`) — a headless
  component (returns `null`) mounted at `tracker-layout.tsx:191`. It owns the
  1-second tick. Because it lives in the layout, **the session engine runs on
  every page of the app, not just /focus**. [CODE]

## Control-flow path

### Starting (setup modal)

```
SessionSetupModal.handleStart()                 session-setup-modal.tsx:118
    ↓ await createSession.mutateAsync({})       → INSERT focus_sessions (status='setup')
    ↓ for each queued task (sequential awaits)
        createSessionTask.mutateAsync(...)      → INSERT session_tasks
    ↓ for each session reminder
        createReminder.mutateAsync(...)         → INSERT reminders
    ↓ await updateSession (status='active',
                           started_at=now)      → UPDATE focus_sessions
    ↓ initSession(session.id, totalAllocatedMs) → Zustand store reset
    ↓ router.push('/focus')
```

- Errors: the whole sequence is wrapped in one try/catch that only
  `console.error`s (`session-setup-modal.tsx:167-168`). A failure midway
  leaves a partially-built session in the DB. [CODE]
- There is no rollback/cleanup of the `setup`-status session on failure.
  `FocusPage` explicitly ignores DB sessions still in `setup`
  (`focus/page.tsx:27` comment), but `useActiveFocusSession` *matches* them
  (`use-focus-sessions.ts:61` — `.in('status', ['setup','active','paused'])`
  with `.limit(1)`). An orphaned setup row can therefore be the row that
  query returns, shadowing nothing today but see Fog. [CODE]

### Ticking (the engine)

```
FocusSessionProvider effect                     focus-session-provider.tsx:38
    ↓ activeSession from useActiveFocusSession() (server state)
    ↓ setInterval(computeElapsed, 1000)
        elapsed = Date.now() - started_at
                  - (activeSession.total_pause_ms + total_break_ms)   :46-49
        taskElapsed = elapsed - taskStartSessionElapsedMs             :54
        warning:  remaining <= warning_buffer → setWarningActive
                  + beep via Web Audio                                :66-70
        auto-advance: taskElapsed >= allocated + extensions           :73
            ↓ updateSessionTask(status='paused_incomplete',
                                actual_time_ms)                       :76-81
            ↓ last task?  s.setSessionStatus('completed')  ← STORE ONLY :85
            ↓ else enterTransition → setTimeout(4000) →
                  setCurrentTaskIndex(next) +
                  updateSessionTask(next, status='active')            :92-104
```

### Manual advance (Done / Skip)

`ActiveSessionView.handleDone` (`active-session-view.tsx:95`) and
`handleSkip` (`:131`) are near-verbatim copies of the auto-advance sequence:
persist current task status (`completed` / `skipped`) with
`actual_time_ms = currentTaskElapsedMs`, then transition → next task, or
`setSessionStatus('completed')` on the last one. **The advance sequence
exists in three places** (Done, Skip, auto-advance) with only the status
literal differing. [CODE]

### Pause / resume

`handlePauseResume` (`active-session-view.tsx:166`): store records
`pauseStartedAt = Date.now()`; on resume the accumulated pause is written to
both the store (`endPause`) and the DB (`total_pause_ms`). The ticking
formula uses the **DB copy** of `total_pause_ms`, which reaches the provider
via the optimistic update in `useUpdateFocusSession.onMutate`
(`use-focus-sessions.ts:127-140`). While paused, the interval keeps running
and elapsed keeps growing on screen? No — status is `paused`, so the effect's
`activeSession.status === 'active'` guard (`focus-session-provider.tsx:44`)
tears the interval down entirely; the display freezes at the last computed
value held in the store. [CODE]

### Refresh / recovery

`FocusPage` effect (`focus/page.tsx:21-29`): if the DB has an
`active`/`paused` session but the store is empty, `initSession(id, 0)` is
called. This resets `currentTaskIndex` to 0 and `taskStartSessionElapsedMs`
to 0. **No code restores which task you were on from the `session_tasks`
statuses.** After a refresh mid-session, the UI shows task #1 as current and
computes task elapsed as the whole session's elapsed. [CODE] — nothing marks
this as intended; it looks like a recovery gap. [INFERRED]

## Data flow

```
QueuedTask[] (modal-local React state: item + minutes + warning buffer)
    ↓ handleStart
focus_sessions row (status 'setup' → 'active', started_at)
session_tasks rows (position, allocated_time_ms, warning_buffer_sec)
    ↓ every second
Zustand store: sessionElapsedMs / currentTaskElapsedMs   (derived, volatile)
    ↓ on each task boundary
session_tasks.status + actual_time_ms                     (persisted)
    ↓ on explicit end only (see finish-a-session territory)
focus_sessions totals + items.cumulative_time_ms
```

Elapsed time is never stored anywhere while the session runs — it is
**re-derived from wall clock** (`started_at` + pause/break totals) on every
tick. `actual_time_ms` snapshots are taken only at task boundaries. [CODE]

## State ownership

```
SessionSetupModal (React useState)
  └── queue, search, sessionReminders — dies on modal close
Zustand focus-session-store
  └── which task index is current, elapsed ms, transition/warning/break
      flags, modal visibility — volatile, lost on refresh
TanStack Query cache
  └── focus_sessions row (['focus-sessions','active']),
      session_tasks (['session-tasks', id]) — mirror of server
Supabase Postgres
  └── durable truth: session status, started_at, pause/break totals,
      per-task allocations and outcomes
```

Duplicated/split ownership worth knowing:

- **Pause/break totals live in both the store and the DB row**, and the tick
  formula reads the DB copy while the summary screen reads the store copy
  (`session-summary.tsx:38-40`). They agree only because both are written at
  the same moments. [CODE]
- **The current task index lives only in the store** — the DB has per-task
  statuses from which it could be derived, but never is. [CODE]

## Side effects and boundaries

- **Supabase (network)**: every task boundary, pause, extension → row
  updates via supabase-js. No batching; each is a separate HTTP call.
- **Wall clock**: `Date.now()` in provider and store.
- **Web Audio API**: warning beep (`focus-session-provider.tsx:194-211`),
  errors swallowed (autoplay policy).
- **`setTimeout`**: 4-second transitions (three call sites) and reminder
  firing. Timeouts are not cleared if the component unmounts mid-transition
  (Done/Skip paths) — the callback will still run and mutate. [CODE]
- **Keyboard**: global `window.addEventListener('keydown')` in
  `active-session-view.tsx:287-342`.

## Decisions embodied by the code

**Decision:** Elapsed time is derived from wall clock (`Date.now() -
started_at - pauses - breaks`), not accumulated tick counts.
**Evidence:** `focus-session-provider.tsx:48-49`; formula documented and
tested in `web/__tests__/time-computation.test.ts:4-8`.
**Consequence:** Timer is correct after tab throttling, sleep, or refresh;
missing a tick can't lose time.
**Possible alternative:** Accumulate `elapsed += 1000` per tick (simpler but
drifts), or server-computed elapsed.
**Trade-off:** Gains robustness; gives up simplicity — correctness now
depends on `total_pause_ms`/`total_break_ms` in the *query cache* being
fresh, which is why pause/resume does an optimistic cache write.

**Decision:** The session engine is a headless app-wide provider, separate
from the /focus page that renders it.
**Evidence:** `tracker-layout.tsx:191`; `focus-session-provider.tsx:191`
returns null.
**Consequence:** Sessions keep ticking while you browse other views;
`FocusSessionIndicator` can render live state anywhere.
**Trade-off:** Gains continuity; gives up locality — timer behavior and its
UI live in different components communicating through a global store.

**Decision:** Task-advance logic is duplicated three times rather than
extracted (Done / Skip / auto-advance).
**Evidence:** `active-session-view.tsx:95-129`, `:131-164`;
`focus-session-provider.tsx:73-105`.
**Consequence:** The three paths can drift; auto-advance already differs
(status `paused_incomplete`, resets its dedup refs).
**Possible alternative:** One `advance(status)` function in the store or a
shared module.
**Trade-off:** Current form is locally readable; edits must be made in
triplicate.

**Decision:** Session creation is a sequence of individual inserts, not a
transaction.
**Evidence:** `session-setup-modal.tsx:122-157` (sequential `await`s).
**Consequence:** Partial failure leaves an orphaned `setup` session and/or a
subset of tasks; no retry or cleanup.
**Possible alternative:** A Postgres function/RPC creating session + tasks
atomically.
**Trade-off:** Gains simplicity (pure supabase-js), gives up atomicity.

**Decision:** Natural completion (finishing the last task) is recorded in
the client store only; the DB write happens on a different path.
**Evidence:** `active-session-view.tsx:111,146`,
`focus-session-provider.tsx:85` vs `useEndFocusSession` (only called from
the End-Session dialog, `active-session-view.tsx:272`).
**Consequence:** See [finish-a-session-and-record-work](finish-a-session-and-record-work.md) —
this is the zombie-session issue.

## Invariants and assumptions

- Exactly **one** session per user is in `setup`/`active`/`paused` at a
  time — assumed by `.limit(1).maybeSingle()` in
  `use-focus-sessions.ts:61-63`; **not enforced by any DB constraint**
  (schema has only a non-unique index `idx_focus_sessions_user_status`). [CODE]
- `sessionTasks` are ordered by `position` and the store's
  `currentTaskIndex` indexes into that array
  (`use-session-tasks.ts:19`, provider `:59`). Reordering mid-session would
  silently change which task is "current". [INFERRED]
- `session_tasks` has `UNIQUE(session_id, task_id)` — the same item cannot
  appear twice in one session (`supabase/migrations/20260406...sql:70`). The
  setup modal also filters queued items out of the picker. [CODE]
- The provider assumes `activeSession.started_at` is set whenever status is
  `active` (`:44`) — guaranteed by `handleStart` writing both together. [CODE]

## Failure modes

- **Partial session creation** (network failure mid-`handleStart`): orphaned
  `setup` session + partial tasks; only a console error. [CODE]
- **Refresh mid-session**: current-task position lost, task elapsed
  mis-computed (see Recovery above). [CODE]
- **Two tabs open**: two providers tick the same session; both can fire
  auto-advance and both will mutate `session_tasks` (dedup refs are
  per-tab). [INFERRED — not observed, follows from architecture]
- **Unmount during 4s transition**: `setTimeout` callbacks in
  handleDone/handleSkip/auto-advance are never cancelled; they run against
  the store and issue mutations after the view is gone. [CODE]
- **Pause across refresh**: `pauseStartedAt` lives only in the store; if you
  refresh while paused, the in-flight pause duration is lost (DB
  `total_pause_ms` was only written on *resume*). Elapsed time silently
  grows by the un-recorded pause. [INFERRED from code paths]

## Tests and verification

- `web/__tests__/focus-session-store.test.ts` — store transitions
  (init/clear/pause/break/transition) assert the store math directly. [TEST]
- `web/__tests__/session-logic.test.ts` — lifecycle flows against the real
  store (init → pause → resume → complete; end-session data assembly;
  keyboard-blocking predicates). Note: it re-implements the *predicates*
  (e.g. which modals block keys) rather than dispatching real key events. [TEST]
- `web/__tests__/time-computation.test.ts` — **re-implements** the elapsed
  formula as a local function (`:10-18` "Extract the computation as a pure
  function") rather than importing the provider. It verifies the formula,
  not the provider's actual code path. Warning-zone and auto-advance
  predicates are similarly local copies. [TEST][CODE]
- **Untested**: FocusSessionProvider itself (interval wiring, dedup refs,
  reminder scheduling), all TanStack mutation hooks, refresh/recovery,
  multi-tab. [CODE]

## Visual map

```
            tracker-layout (always mounted)
            ├── FocusSessionProvider ──(1s tick)──► Zustand store
            │        │  reads: focus_sessions.active, session_tasks
            │        └─ writes: session_tasks on auto-advance
            ├── FocusSessionIndicator  (reads store)
            └── SessionSetupModal      (writes DB, then initSession)

/focus page
  FocusPage ── store.status? ──┬─ null ──────► empty state
                               ├─ active ────► ActiveSessionView
                               │                 ├─ CurrentTaskCard (store elapsed)
                               │                 ├─ SessionControls → handleDone/Skip/Pause…
                               │                 └─ TaskQueuePanel / overlays
                               └─ completed ─► SessionSummary

Task lifecycle:   pending → active → { completed | skipped | paused_incomplete }
Session lifecycle (DB):  setup → active ⇄ paused → { completed | abandoned }
                                          (natural finish: store says completed,
                                           DB row may stay 'active' — see Fog)
```

## Fog

- ? After finishing the last task naturally, the DB session is still
  `active`. What exactly happens when you next visit /focus after "Back to
  Board"? (Trace `focus/page.tsx:21-29` with store cleared.)
- ? What happens with two tabs open on the same session — double
  auto-advance? double `paused_incomplete` writes?
- ? Interval reminders: the scheduling effect
  (`focus-session-provider.tsx:148-184`) runs only when `activeSession` or
  `allReminders` changes, and schedules exactly one timeout per reminder.
  After a reminder fires, nothing re-runs the effect — do recurring interval
  reminders actually recur?
- ? If a `setup`-status orphan session exists alongside an `active` one,
  which row does `.limit(1)` return? There's no `order by` — is it
  deterministic?
- ? Why does auto-advance mark the expired task `paused_incomplete` while
  the end-session dialog also maps `active → paused_incomplete` — are these
  meant to be the same concept ("returned to board")?
- ? `setCurrentTaskIndex(nextIndex, st.sessionElapsedMs)` uses the elapsed
  value captured *after* the 4s transition — is transition time counted
  against the next task's budget, the session total, both?
- ? Extensions (`extensions_ms`) increase a task's budget, but
  `totalAllocatedMs` for the progress bar is recomputed from
  allocated+extensions (`active-session-view.tsx:66-74`) — does the progress
  bar jump backward when you extend?
- ? Does the warning beep actually play if the user hasn't interacted with
  the page (AudioContext autoplay policy)? The catch swallows it.

## Suggested walk

1. Start at `tracker-layout.tsx:185-205` — see what's always mounted.
2. Read `focus/page.tsx` top to bottom; predict what happens on a refresh
   mid-session before reading the two effects.
3. Open `session-setup-modal.tsx:118` (`handleStart`). Count the network
   round-trips for a 3-task session. Predict what state exists if call #3
   fails.
4. Read the store (`focus-session-store.ts`) — it's the vocabulary of the
   whole territory. Note which fields are *derived* every tick vs *event*
   state.
5. Read `focus-session-provider.tsx:38-116` slowly. Before line 73, predict
   how auto-advance avoids firing twice for the same task.
6. Read `active-session-view.tsx:95-164` (Done/Skip) and diff them mentally
   against the provider's auto-advance.
7. Finish with `session-logic.test.ts` — check which of your mental model
   the tests actually pin down.

## Ownership challenge

Make refresh-recovery restore the current task: on `initSession` from an
existing DB session, derive `currentTaskIndex` from the first
`session_tasks` row whose status is `active` (or first `pending`), and set
`taskStartSessionElapsedMs` from its `started_at`. Add a test to
`session-logic.test.ts` that documents the restored-index behavior.
