# Territory: Finish a session and record the work

## The question

When a session ends, what actually gets written where — and is a session
that ends "naturally" (all tasks done) recorded the same way as one ended
through the End Session dialog?

## User-visible behavior

```
Last task ends (Done/Skip/expiry)        OR   user presses Esc → "End Session?"
    ↓                                              ↓ Complete / Abandon
summary screen appears:
    time breakdown (active / paused / breaks)
    completed tasks, tasks "returned to board"
    per-task allocated-vs-actual table
    log entries, optional reflection form, "save as template"
    ↓
"Back to Board" or "Start New Session"
```

Afterward, each task's card shows accumulated focus time
(`cumulative_time_ms`) and its status may have changed (done / in_progress).

## Entry point

There are **two distinct ending paths that do not do the same thing**:

1. **Explicit end** — `ActiveSessionView.handleEndSession()`
   (`web/components/focus/active-session-view.tsx:249`), invoked from the
   End-Session dialog (Esc or the ✕ control). This is the only caller of
   `useEndFocusSession` in the codebase (verified by grep). [CODE]
2. **Natural completion** — three code sites set
   `setSessionStatus('completed')` on the Zustand store when the last task
   ends (`active-session-view.tsx:111,146`,
   `focus-session-provider.tsx:85`) **without any focus_sessions DB
   write**. [CODE]

## Control-flow path

### Explicit end

```
handleEndSession(abandoned)                     active-session-view.tsx:249
    ↓ snapshot current task → status 'paused_incomplete' if it was active
    ↓ updateSessionTask.mutate(current task)    (fire-and-forget)
    ↓ build taskData[] from query-cache session_tasks
    ↓ await endFocusSession.mutateAsync(...)    use-focus-sessions.ts:153
        ↓ UPDATE focus_sessions SET status, completed_at, ended_by,
                 total_active_ms/pause/break                     :177-189
        ↓ for each session task (sequential):                    :194
            supabase.rpc('increment_item_session_stats', ...)    :196
            → **this RPC is not defined in any migration or
               schema.sql** (grep of supabase/ finds no definition),
               so it errors every time and the fallback runs:    [CODE]
            fallback: SELECT item → UPDATE items SET
                 cumulative_time_ms += actual,
                 session_count += 1,
                 status = task completed ? 'done' : 'in_progress' :203-218
    ↓ setSessionStatus('completed'|'abandoned')  → FocusPage swaps to summary
```

### Natural completion

```
last task Done/Skip/expiry
    ↓ updateSessionTask (last task's own status/actual_time)   [persisted]
    ↓ setSessionStatus('completed')                            [store only]
    ↓ FocusPage renders SessionSummary
    ✗ focus_sessions row still status='active' in the DB
    ✗ items.cumulative_time_ms / session_count never updated
    ✗ ended_by, completed_at, totals never written
```

`SessionSummary` (`session-summary.tsx`) reads everything it displays from
the **store** (elapsed/pause/break) and the `session_tasks` cache — it never
persists the session end. Its "Back to Board" button just
`clearSession()` + navigate (`:81-84`). [CODE]

**Consequence (zombie session):** after a natural finish, the DB still holds
an `active` session. On the next visit to /focus, `FocusPage`'s re-sync
effect (`focus/page.tsx:21-29`) sees it and re-enters `ActiveSessionView`
with elapsed time still accumulating since the original `started_at`.
[INFERRED from the code paths above; not directly observed in a running app]

## Data flow

```
Zustand store (elapsedMs, totalPauseMs, totalBreakMs)
        +
session_tasks cache (statuses, actual_time_ms, extensions)
    ↓ handleEndSession assembles
taskData[] {task_id, actual_time_ms, status}
    ↓ useEndFocusSession
focus_sessions row (final status + totals)          ─── durable
items rows (cumulative_time_ms, session_count,
            status done/in_progress)                ─── durable, denormalized
    ↓ SessionReflection form (separate, optional)
session_reflections row (UNIQUE per session)
    ↓ "Save as template" (optional)
session_templates row (JSONB slots snapshot)
```

Note `actual_time_ms` for the *current* task is taken from the store's
live `currentTaskElapsedMs` (`active-session-view.tsx:268`), while completed
tasks use the value persisted at their boundary. The current task is also
updated twice — once directly (`:258`) and once inside the items write-back
loop via `taskData` (items only, but both derive from the same snapshot). [CODE]

## State ownership

```
Zustand store        → the ONLY source for total_active_ms/pause/break at end
session_tasks (DB)   → per-task outcomes (written at each boundary)
items (DB)           → denormalized lifetime stats (cumulative_time_ms,
                       session_count) — written only on explicit end
time_entries (DB)    → a SEPARATE time-tracking system (manual timers);
                       focus-session time is never written here, and
                       TimeSummary (`components/timer/time-summary.tsx`)
                       aggregates ONLY time_entries. Focus time and timer
                       time never meet. [CODE]
```

## Side effects and boundaries

- Supabase: 1 session UPDATE + up to 3 calls per task (failed RPC, SELECT,
  UPDATE) — all sequential, non-transactional (`use-focus-sessions.ts:194-220`).
- No queue/retry: if a per-task write fails, the loop just moves on
  (fallback errors aren't even checked — `await supabase.from('items').update`
  result is discarded). [CODE]

## Decisions embodied by the code

**Decision:** Lifetime task stats are denormalized onto `items`
(`cumulative_time_ms`, `session_count`) instead of aggregated from
`session_tasks` at read time.
**Evidence:** `supabase/migrations/20260406...sql:10-13`;
`use-focus-sessions.ts:194-220`.
**Consequence:** Cheap reads for card badges; correctness depends on every
end-path running the write-back — which the natural-completion path never
does.
**Possible alternative:** A DB view/aggregate over `session_tasks`, or a
trigger on `session_tasks` status change.
**Trade-off:** Read speed vs. a write path that can (and does) miss.

**Decision:** Increment-via-RPC with a client-side read-modify-write
fallback; the RPC was never created.
**Evidence:** `use-focus-sessions.ts:196` calls
`increment_item_session_stats`; no `CREATE FUNCTION` for it exists anywhere
in `supabase/`. [CODE]
**Consequence:** Every end pays a failed RPC round-trip per task, then a
non-atomic SELECT+UPDATE (lost-update race if anything else touches the
item). Also the intended RPC (judging by its args) would *not* have updated
item status, while the fallback does — the two paths were never equivalent.
**Possible alternative:** Ship the migration defining the RPC (atomic
`UPDATE ... SET x = x + $1`), or drop the RPC attempt.
**Trade-off:** As-is: works but slow, racy, and misleading to readers.

**Decision:** Ending is client-orchestrated; the server has no concept of
"finalize session".
**Evidence:** All finalization logic in `useEndFocusSession` (client).
**Consequence:** Closing the tab mid-end (or the natural-completion path)
leaves inconsistent state; nothing server-side reconciles.
**Possible alternative:** Postgres function `end_session(session_id, ...)`
doing session update + stat increments in one transaction.

**Decision:** Skipped tasks still increment `session_count` and set the item
to `in_progress`.
**Evidence:** `use-focus-sessions.ts:213-216` (`status === 'completed' ?
'done' : 'in_progress'` applied to every task in the loop, including
`skipped`; `session_count + 1` unconditionally).
**Consequence:** A task you skipped after 5 seconds gets a session counted
and may be promoted from `todo` to `in_progress`.
**Trade-off:** Matches the "returned to board" framing [DOC:
`docs/flowviate-focus-sessions-daily-rhythm-prd.md` §3.3.4]; but the PRD
does not say skips should count as sessions — [UNKNOWN] whether intended.

## Invariants and assumptions

- `useEndFocusSession` assumes the store totals are authoritative at end
  time (`total_active_ms: s.sessionElapsedMs` —
  `active-session-view.tsx:275`). If the provider tick was stale (tab
  throttled at the exact end moment), the persisted totals inherit that. [INFERRED]
- `session_reflections` enforces one reflection per session
  (`UNIQUE(session_id)`, migration `:201`). The reflection form appears on
  every summary view; a second submit would violate the constraint —
  [UNKNOWN] how the UI handles that error.
- Assumes every queued item still exists at end time (items are
  `ON DELETE CASCADE` into `session_tasks`, so a deleted item silently
  vanishes from the write-back loop). [CODE]

## Failure modes

- **Zombie session** (natural completion): DB session stays `active`; stats
  never written; re-entering /focus resumes a "ghost" of the session. [CODE→INFERRED]
- **Partial write-back**: session marked `completed`, then a per-task item
  update fails → session closed but stats missing; no retry, error
  discarded. [CODE]
- **Lost update on items**: fallback SELECT-then-UPDATE isn't atomic;
  concurrent edits to the same item can drop an increment. [INFERRED]
- **Double end**: `handleEndSession` can be invoked twice (double Esc+click)
  — second run re-runs the whole loop, double-counting
  `cumulative_time_ms`/`session_count`. Nothing guards on session status. [INFERRED]

## Tests and verification

- `session-logic.test.ts` "end session data assembly" (`:302-348`) pins the
  `taskData` mapping rules (active→paused_incomplete, completed/skipped kept)
  — but against a local re-implementation of the mapping, not
  `handleEndSession` itself. [TEST]
- **Untested**: `useEndFocusSession` entirely (RPC failure path, write-back
  loop, status mapping to items), the natural-completion persistence gap,
  summary rendering. [CODE]

## Visual map

```
                 ┌──────────── explicit end (dialog) ────────────┐
                 │ focus_sessions: status/totals/ended_by  ✔     │
                 │ items: cumulative_time_ms += , count++  ✔     │
                 │        status → done / in_progress      ✔     │
                 └───────────────────────────────────────────────┘
 last task ends
                 ┌──────────── natural completion ───────────────┐
                 │ store.sessionStatus = 'completed'       ✔     │
                 │ focus_sessions row                      ✘ (!) │
                 │ items stats                             ✘ (!) │
                 └───────────────────────────────────────────────┘
                                    ↓ both
                            SessionSummary (reads store + cache)
                                    ↓ optional
                     session_reflections / session_templates
```

## Fog

- ? Reproduce the zombie session in the running app: finish all tasks, click
  "Back to Board", revisit /focus. What does the timer show?
- ? Was the missing `increment_item_session_stats` RPC ever written (check
  the Supabase dashboard / remote DB), or has the fallback always been the
  real path? Local `supabase/` says it doesn't exist — the remote could
  differ. [UNKNOWN]
- ? Is ending idempotent? What stops double-counting on a second
  "Complete Session" click before the first resolves?
- ? Why do focus sessions and time_entries never merge? Should a focus
  session write time_entries rows so TimeSummary reflects focus work?
  (Architectural question — two parallel time systems exist.)
- ? What does submitting the reflection twice do (UNIQUE violation)?
- ? `total_active_ms` is stored but nothing appears to read it back —
  is any history/analytics view planned that consumes `focus_sessions`
  totals? (PRD §7 promises per-task/per-project stats.) [DOC vs CODE]
- ? Abandoning: `ended_by='abandoned'` sets session status `abandoned`, but
  items still get stats incremented for completed tasks — intended?

## Suggested walk

1. Start at `active-session-view.tsx:249` (`handleEndSession`). Write down
   every row you expect to change before reading further.
2. Read `useEndFocusSession` (`use-focus-sessions.ts:153-230`). Note where
   the RPC is called; then grep `supabase/` for its definition.
3. Read the three `setSessionStatus('completed')` sites and confirm none
   persists. Then re-read `focus/page.tsx:21-38` and predict the next-visit
   behavior.
4. Open `session-summary.tsx` and verify which numbers come from the store
   vs the DB.
5. Compare with `docs/flowviate-focus-sessions-daily-rhythm-prd.md` §3.6
   (Session End) — list what the PRD promises that this path doesn't do.

## Ownership challenge

Unify the two ending paths: make natural completion call the same
finalization as the dialog (persist status/totals/stats exactly once), and
add an idempotency guard (skip finalization if the session row is already
`completed`/`abandoned`). Decide — and document — whether skipped tasks
should increment `session_count`.
