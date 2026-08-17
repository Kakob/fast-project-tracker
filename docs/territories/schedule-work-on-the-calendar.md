# Territory: Schedule work on the calendar

## The question

The app has two different "when" fields — `due_date` and `scheduled_start` —
which views read and write which, and do they ever meet?

## User-visible behavior

```
/calendar opens in WEEK mode (default)
    ↓ week mode
7-day × 24h grid; drag on empty space → creates a time block
  ("New task", details panel opens with title auto-cleared for typing)
drag a block → move it; drag bottom edge → resize (15-min snapping)
red "now" line; auto-scroll to 7 AM
    ↓ press w (month mode)
month grid of chips keyed by DUE DATE; drag chip between days → changes due date
```

The same item can appear in both modes only if it has *both* fields set —
nothing syncs them.

## Entry point

- Route: `web/app/(tracker)/calendar/page.tsx` — owns the mode toggle
  (`:42`, default `'week'`) and the month grid.
- Week rendering + all drag interactions: `web/components/views/week-view.tsx`,
  mounted from `calendar/page.tsx:281-287`. It's the only view that receives
  `items` as a prop instead of calling `useItems()` itself. [CODE]

## Control-flow path

```
Month mode                          Week mode
──────────                          ─────────
drag chip → day cell                mousedown on empty column
  ↓ handleDrop                        ↓ ghost block follows cursor (local state)
useUpdateItem({due_date})             ↓ mouseup
                                    useCreateItem({title:'New task',
                                      scheduled_start, duration_minutes})
                                      ↓ setAutoClearTitleItemId(id)
                                      ↓ openDetailsPanel(id)
                                    panel auto-focuses title and CLEARS it
                                    on first focus (item-details-panel:97-102)

                                    drag existing block  → useUpdateItem({scheduled_start})
                                    resize bottom handle → useUpdateItem({duration_minutes})
                                    snapping: round-to-15 (move/resize),
                                              floor-to-15 (create)  week-view:569-575
```

Overlapping blocks are laid out in lanes via a greedy interval algorithm
(`week-view.tsx:623-663`). A bare click (no drag movement) creates a 30-min
block. [CODE]

## Data flow

```
items.due_date        (DATE, "soft deadline")   ← month mode reads/writes
items.scheduled_start (TIMESTAMPTZ, exact slot) ← week mode reads/writes
items.duration_minutes (default 30, min 15 in UI, CHECK > 0 in DB)
```

The migration comment is the only place the model is stated:
"an exact start timestamp + duration … distinct from due_date (a soft
deadline)" (`supabase/migrations/20260509000000_add_scheduled_time.sql:2-3`).
[DOC] Nothing derives one field from the other; only the details panel
displays both together. [CODE]

Note: the migration is named `add_scheduled_time` but no `scheduled_time`
column exists — the columns are `scheduled_start` + `duration_minutes`. [CODE]

## State ownership

```
calendar/page.tsx local state → mode (month/week), currentDate
week-view local state/refs    → in-progress drag (ghost), now-line timer
ui-store                      → autoClearTitleItemId (one-shot handoff from
                                week-view create → details panel)
items table                   → both scheduling fields
```

The `autoClearTitleItemId` handoff is the one place two components
communicate a one-shot instruction through the global store
(`week-view.tsx:256` produces; `item-details-panel.tsx:43,98` consumes and
clears). [CODE]

## Decisions embodied by the code

**Decision:** Two independent time axes — deadline (`due_date`) vs time
block (`scheduled_start`).
**Evidence:** migration comment [DOC]; disjoint read/write sets in month vs
week code. [CODE]
**Consequence:** Scheduling a task in week view does not surface it in month
view and vice versa; users must maintain both by hand.
**Possible alternative:** Derive due_date from scheduled_start when unset,
or render scheduled items in month mode too.
**Trade-off:** Clean semantics, at the cost of two half-connected calendars.

**Decision:** Create-on-drag inserts a real row immediately ("New task"),
then relies on the auto-clear-title flow for naming.
**Evidence:** `week-view.tsx:237-259`.
**Consequence:** Abandoning the panel (Esc) leaves a literal "New task" item
in the database. [INFERRED]
**Possible alternative:** Ghost-until-named (only insert on title commit).

**Decision:** Pixel-time mapping is 1px = 1min with 15-minute snapping done
in the view, not validated in the DB (DB only checks `duration > 0`).
**Evidence:** `week-view.tsx:10,569-575`; migration CHECK.
**Consequence:** Other write paths (details panel rounds to nearest 5,
min 5 — `item-details-panel.tsx:145-149`) can produce durations the week
view would never create. Two write paths, two rounding rules. [CODE]

## Failure modes

- Abandoned drag-created "New task" rows accumulate. [INFERRED]
- Week mode is the default but has **zero keyboard support**, while the help
  popup advertises month-mode keys unqualified. [CODE]
- Month-mode arrow navigation walks *every dated item in the DB* while cells
  render only 3 — focus can sit on an invisible item. [CODE]
- Month chips have no project colors (calendar never loads projects),
  inconsistent with board/list. [CODE]

## Tests and verification

Nothing in `web/__tests__/` touches the calendar, week view, drag logic,
lane layout, or snapping. `layoutLanes` and `snap/floorSnap` are pure
functions that would be trivially testable. [CODE]

## Visual map

```
        due_date (soft deadline)             scheduled_start + duration
        ───────────────────────              ─────────────────────────
month grid  ◄─ read/write ─┐                 ┌─ read/write ─►  week grid
                           │                 │
                        items row  ◄── both shown only in details panel
                           ▲
              board/list show due_date as a chip (read-only)
```

## Fog

- ? Is the two-axis model (deadline vs block) a settled design or an
  unfinished migration? No view surfaces both, nothing syncs them. [DOC vs CODE]
- ? What should happen to a scheduled block when its item is marked done —
  today it stays on the calendar. [UNKNOWN]
- ? Why does week view receive `items` as a prop when every other view
  queries directly?
- ? Are abandoned "New task" rows an accepted cost?
- ? `start_date` (a third date field on items) exists in types and schema
  but appears unread by any view — what was it for? [UNKNOWN]

## Suggested walk

(Good 15–30 min exercise: `layoutLanes` + `snap` are self-contained.)

1. Read the migration file first — it states the intended model in two lines.
2. Read `calendar/page.tsx:42` and note the default mode; skim the month
   grid's `itemsByDate`.
3. In `week-view.tsx`, read the three drag branches (create/move/resize)
   before the render; predict what each writes to the DB.
4. Read `layoutLanes` (`:623-663`) and hand-trace two overlapping items.
5. Follow `autoClearTitleItemId` from `week-view.tsx:256` into
   `item-details-panel.tsx`.

## Ownership challenge

Write unit tests for `layoutLanes` and `snap`/`floorSnap` (extract them if
needed), then fix one interaction bug of your choosing — e.g. make Esc on a
freshly drag-created, never-renamed item delete it instead of leaving
"New task" behind.
