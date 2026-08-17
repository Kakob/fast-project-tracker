# Territory: Track time with ad-hoc timers

## The question

The timer button on a card and the focus session both "track time" — are
they the same system? (No. This territory is the *other* time system.)

## User-visible behavior

```
click ▶ on any item (board/list/archive card, details panel) or press t
    ↓
timer starts; starting a timer on another item auto-stops the first
    ↓
header shows a global running indicator; details panel shows live total
    ↓
click ⏹ (or start elsewhere) → entry recorded with duration
    ↓
TimeSummary popover (header ⏱): today / this week / by project / top items
```

## Entry point

- `TimerButton` (`components/timer/timer-button.tsx`) on cards and panel.
- Global `t` shortcut (`tracker-layout.tsx:96-107`) — targets
  `focusedItemId || selectedItemId`, suppressed during focus sessions.
- Ticking: `TimerProvider` (`components/timer/timer-provider.tsx`), headless,
  mounted at `tracker-layout.tsx:190`, mirrors the active entry into
  ui-store (`activeTimerItemId`, `timerElapsedSeconds`).

## Control-flow path

```
useStartTimer().mutate({item_id})              use-time-entries.ts:75
    ↓ find running entry (ended_at IS NULL) → if found, stop it
      (compute duration client-side, UPDATE)                :84-101
    ↓ INSERT new time_entries row (started_at client clock)
useStopTimer()                                              :158
    ↓ find running entry → UPDATE ended_at + duration_seconds
```

"One running timer per user" is enforced **only by this client-side
stop-then-start sequence** — the DB has a partial index on
`(user_id) WHERE ended_at IS NULL` but no unique constraint. Two tabs can
create two running entries. [CODE]

## Data flow / state ownership

```
time_entries rows (durable; ended_at NULL = running)
    → TimerProvider polls/derives elapsed → ui-store timer fields
    → TimeSummary aggregates entries CLIENT-SIDE (today/week/project)
    → item-details-panel sums per-item entries + live elapsed
```

**The two time systems never meet.** Focus sessions write
`items.cumulative_time_ms` (and only on the explicit-end path); timers
write `time_entries`. `TimeSummary` reads only `time_entries`
(`time-summary.tsx:45-96`); nothing anywhere adds focus-session time into
the summary, and nothing turns session tasks into time entries. [CODE]

## Decisions embodied by the code

**Decision:** Duration is computed client-side at stop time and stored
denormalized (`duration_seconds`), with `ended_at NULL` as the running
sentinel.
**Evidence:** `use-time-entries.ts:92-100,177-186`; migration comment
"computed on stop for fast aggregation".
**Trade-off:** Fast aggregation; trusts client clocks; a crashed tab leaves
an eternally-running entry (visible as ever-growing elapsed).

**Decision:** Ad-hoc timers and focus sessions are separate subsystems with
separate storage.
**Evidence:** disjoint tables and read paths (above).
**Consequence:** "How long did I work on X?" has two partial answers.
Whether unification is intended is [UNKNOWN] — the PRD's stats section (§7)
describes per-task/per-project stats without resolving this.

## Failure modes

- Two tabs → two running entries; stop only closes one. [INFERRED]
- Crashed/closed tab → orphaned running entry with NULL ended_at; nothing
  reconciles it (you can delete entries in the details panel only if
  `ended_at` is set — `item-details-panel.tsx:408`). [CODE]
- You can start a timer on an **archived** item (archive page renders
  TimerButton). [CODE]

## Tests

`ui-store.test.ts` covers the timer store fields; the hooks and provider
are untested. [TEST][CODE]

## Fog

- ? Should focus-session work generate time_entries so one summary exists?
- ? What does the UI show for an orphaned running entry from yesterday?
- ? Why does the `t` shortcut fall back to `selectedItemId` (last-opened
  item, possibly from another view)?

## Suggested walk

(Good 15–30 min exercise — the smallest complete subsystem in the app.)

1. Read `use-time-entries.ts` fully, then `timer-provider.tsx` (46 lines).
2. Predict the two-tab behavior before reading `useStartTimer`'s
   stop-then-start.
3. Open `time-summary.tsx` and confirm which table it reads.

## Ownership challenge

Enforce "one running timer" in the DB: a partial unique index
`(user_id) WHERE ended_at IS NULL`, plus handling the insert conflict in
`useStartTimer`. Then decide what stop-behavior two racing tabs should see.
