# Territory: Remind and log during sessions (the "daily rhythm" layer)

## The question

I set a reminder for every 20 minutes and logged my mood mid-session — what
machinery fired that toast, where did the log go, and how much of the PRD's
reminder/logging system actually exists?

**Summary up front:** the schema models the full PRD vision; the code
implements a thin slice of it. This territory has the largest
promised-vs-built gap in the app.

## User-visible behavior

```
Session setup: add "session reminders" (text + interval OR moment)
    ↓ during an active session
toast appears (8s auto-dismiss) when an interval elapses
    ↓ press l (or Log button)
log prompt modal: one input per log type (Mood 1-5, Energy 1-5, Notes)
    ↓ save
entries appear later in the session summary
    ↓ after session
reflection form (how it went 1-5, wins, friction, notes)
"save as template" snapshots the task list for reuse
```

## Entry points

- Reminder authoring: `reminder-setup.tsx` inside the setup modal — **the
  only place reminders are created** (`session-setup-modal.tsx:139-150`),
  always `source_type:'session'`. No UI creates global or task reminders;
  globals render read-only. [CODE]
- Reminder firing: one effect in `focus-session-provider.tsx:148-184`.
- Logging: `LogPrompt` (`log-prompt.tsx`), opened via `l` key, the Log
  button, or (theoretically) a reminder toast.
- Reflection: `session-reflection.tsx`, shown by default on every summary.
- Breaks: `handleBreak`/`handleEndBreak` in `active-session-view.tsx:210-247`
  + break countdown in the provider (`:119-143`).

## Control-flow path — reminder firing (the subtle one)

```
effect [deps: activeSession, allReminders]     focus-session-provider.tsx:148
    ↓ filter: is_active && (global | this session | current task)
    ↓ ONLY trigger_type === 'interval' is handled            :166
        nextFire = ceil((elapsed+1)/interval) * interval
        setTimeout(fire, delay)   — armed ONCE per effect run
        (delay must be < 1 hour or the reminder is silently dropped :172)
    ↓ on fire: addFiredReminder(id) + setPendingReminderPrompt
    ↓ ReminderToast renders; auto-dismiss 8s; TTS if delivery
      audio/both (never set → dead path)
```

Consequences, all [CODE] from the daily-rhythm exploration:

- **Interval reminders do not actually recur.** The timeout is never
  re-armed after firing (store changes don't re-run the effect). In
  practice a reminder fires roughly once per pause/break/mutation event
  (those invalidate the active-session query, re-running the effect).
- **`moment` reminders (start/halfway/end) are written to the DB but no
  code ever fires them** — the engine has no moment branch. Write-only data.
- **Reminder→log wiring is unreachable**: the toast's "Log now" button
  requires `triggers_log_type_id`, which no creator ever sets. Even if
  reached, it opens the generic all-types prompt with `source:'manual'`,
  not the PRD's targeted prompt with `source:'reminder_prompt'`.
- `firedReminderIds` is collected in the store and **never read** — the
  PRD's "reminders that fired" summary item was never built.
- Mid-session reminder editing: `useUpdateReminder`/`useDeleteReminder`
  exist with zero call sites; the session panel is display-only.

## Control-flow path — logging

```
'l' → LogPrompt renders EVERY log type at once
    ↓ save: one awaited INSERT per non-empty type (sequential loop,
             log-prompt.tsx:64-75)
log_entries rows (session_id NOT NULL — DB forbids standalone journaling;
                  source is always 'manual'; RLS allows no UPDATE/DELETE →
                  append-only at the DB layer)
```

Log *types* are seed-only: `handle_new_user()` creates Mood/Energy/Notes;
`use-log-types.ts` is query-only — **the PRD's log type builder does not
exist**, and users bootstrapped via the client-side profile fallback (see
sign-in territory) have zero log types and an empty prompt. [CODE]

## Control-flow path — breaks (two divergent endings)

```
start: INSERT breaks row (break_type always 'manual', even from the
       between-tasks transition) → store.startBreak → session paused
    ↓
manual end:  PATCH breaks.ended_at + resume session + persist total_break_ms   ✔
auto-expiry: (planned duration reached) store.endBreak() ONLY —
             breaks.ended_at stays NULL, session stays 'paused' in DB,
             total_break_ms not persisted                                      ✘
             focus-session-provider.tsx:131-133
```

A timed break that runs to its natural end leaves the DB inconsistent; the
UI recovers only because the store flips `isOnBreak` locally. [CODE]

## Data flow

```
draft reminders (modal local state) → reminders rows (session-scoped)
store.pendingReminderPrompt → toast → dismissed (nothing persisted about firing)
log form values → log_entries rows (append-only)
reflection form → session_reflections (UNIQUE per session; plain INSERT —
                  second submit would violate the constraint; the read hook
                  that could prevent this has zero call sites)
sessionTasks at summary → session_templates.template_data JSONB
```

Template application: "clone exact" rebuilds the queue from slot task_ids
(silently dropping deleted items); **"clone structure only" is a no-op** —
the loop body is inside `if (cloneExact)` (`session-setup-modal.tsx:102-113`).
`focus_sessions.template_id` is plumbed end-to-end but always null —
`handleStart` calls `createSession.mutateAsync({})`. [CODE]

## State ownership

```
reminders/log_types/log_entries/breaks/reflections/templates → Postgres
which reminders fired, pending toast → Zustand store (volatile, unread)
draft reminders, log form values     → component-local React state
```

## Decisions embodied by the code

**Decision:** The schema was built to the full PRD (polymorphic reminder
sources, three trigger types, delivery modes, audio_url, log-triggering
reminders, tier column), while the code implements one narrow path.
**Evidence:** compare `supabase/migrations/20260406…sql:105-133` with the
single-branch engine (`focus-session-provider.tsx:166`).
**Consequence:** Reading the schema wildly overestimates what the app does;
several columns are write-only or never written.
**Trade-off:** Schema-first meant no migrations needed as features land —
but it left a large silent gap between data model and behavior.

**Decision:** Reminder firing is client-side setTimeout scheduling derived
from elapsed time, not a per-tick check in the 1s interval.
**Evidence:** `focus-session-provider.tsx:163-181`.
**Consequence:** Cheap; but correctness depends on effect re-runs, which is
why recurrence is broken. A per-tick check (the interval already runs every
second) would have been trivially correct.
**Possible alternative:** Check due reminders inside `computeElapsed`.

**Decision:** Logging is append-only, session-scoped, enforced by RLS and
NOT NULL — stronger than the PRD's prose non-goal of "no standalone
journaling".
**Evidence:** `log_entries.session_id NOT NULL`; SELECT+INSERT-only
policies. [CODE]

## PRD vs code (§4/§5 cross-check — the fog curriculum)

Not implemented despite PRD promises: global/task reminder authoring, the
`items.intention` authoring path (displayed but never writable —
`use-items.ts` hardcodes null), recurring intervals, moment triggers,
manual timeline placement, delivery configuration/TTS-in-practice,
audio_url recording, mid-session reminder editing, reminder-triggered
logging, the log type builder, session-end log prompts
(`source:'session_end'` never written), "reminders that fired" in the
summary, custom break durations, save-template-before-start,
clone-structure-only, and the free-tier 1-hour cap (`profiles.tier` is
read nowhere). The PRD itself is inconsistent about whether log-triggering
reminders and custom log types are v1 or v1.5 (compare its v1 scope list
with §14). [DOC vs CODE]

## Failure modes

- Auto-expiring timed break → open-ended `breaks` row + session stuck
  `paused` in DB. [CODE]
- Second reflection submit → unique violation surfaced how? [UNKNOWN]
- Reminder scheduled >1h out silently never fires. [CODE]
- Task-scoped reminders filter against a snapshot of the current task taken
  when the effect ran — task advances don't re-run it. [CODE]

## Tests and verification

- Store-level reminder state (`addFiredReminder`) is tested
  (`focus-session-store.test.ts:230-249`) — which is ironic, since nothing
  reads that state. [TEST]
- **Untested:** the entire firing engine, log prompt, reflection, templates,
  breaks. [CODE]

## Visual map

```
 PRD vision:  global/task/session sources × interval/moment/manual triggers
              × visual/audio delivery × log-triggering
                     │ (schema models all of this)
                     ▼
 Built path:  session-scoped text reminder ─ interval only ─ fires ~once
              ─ visual toast, 8s ─ dismissed, nothing recorded

 Logging:     l key → all-types form → append-only rows → summary list
 Reflection:  summary → one-shot form → UNIQUE row
 Breaks:      manual end ✔ persisted │ auto-expiry ✘ store-only
```

## Fog

- ? Was recurrence lost in a refactor? `firedReminderIds` + its tests look
  like the remains of a dedupe-and-repeat design. Check git history.
- ? Why do the provider and the session panel filter reminders with
  near-identical predicates that differ on `is_active`? Which is canonical?
- ? Is the polymorphic `source_id` (no FK, no CHECK) deliberate design
  ("polymorphic reminder source pattern" per PRD) or a missing constraint?
- ? Auto-expiring breaks: is the store-only ending an oversight or is some
  reconciliation intended?
- ? Are the summary's time-breakdown numbers supposed to survive a reload?
  They come from the store; the DB totals written at end are never read
  back — a reload during summary shows 0s/0s/0s. [CODE]
- ? Where was the log type builder / settings surface meant to live? No
  settings route exists.

## Suggested walk

(Good 15–30 min exercises: the reminder engine, or the break lifecycle.)

1. Read the reminders table DDL, then `reminder-setup.tsx`, and list which
   columns the UI can actually populate.
2. Read `focus-session-provider.tsx:148-184` and predict: when does an
   "every 20 min" reminder fire during a 60-min uninterrupted session?
3. Trace one log entry: `l` key → `log-prompt.tsx` save loop → table →
   `session-summary.tsx:254-276` display.
4. Read both break-ending paths side by side (`active-session-view.tsx:233`
   vs `focus-session-provider.tsx:131`) and diff their side effects.
5. Skim PRD §4–5 last, marking each promise built/unbuilt — you'll have
   independently derived the table above.

## Ownership challenge

Make interval reminders actually recur: move the due-check into the
provider's 1-second tick (fire when `elapsed % interval` crosses zero,
dedup via `firedReminderIds` — finally giving it a reader), and delete the
setTimeout scheduling. Alternatively (smaller): fix auto-expiring breaks to
persist `ended_at`, resume the session, and write `total_break_ms`, exactly
as the manual path does.
