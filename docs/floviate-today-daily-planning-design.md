# Floviate: Today Page & Daily Planning — Design Doc

**Author:** Jacob
**Status:** Draft
**Last Updated:** July 9, 2026
**Depends on:** Focus Session Engine (built), Daily Rhythm logging (built)
**Relationship to other docs:** This is the thin daily layer on top of the existing focus engine. The Journal PRD (v8) stays deferred until this loop is dogfooded daily.

---

## 1. Problem

The focus session engine tracks *sessions*, but nothing connects them into a *day*. There is no way to:

- Plan tomorrow the night before.
- See progress toward a daily goal while working.
- Include non-work time (exercise, art) intentionally in the day.
- Review how the day actually went vs. the plan.

The deeper problem is **plan abandonment**, not planning. Most planning tools fail the same way: you fall behind by mid-morning, the plan becomes a guilt artifact, and by the end of the week you stop opening the app. Any daily layer that punishes deviation will be abandoned.

---

## 2. Design Principles

These are the constraints every feature in this doc must satisfy.

### P1. The plan is a default, not a contract

The plan's job is to answer "what should I be doing right now?" — not to be executed perfectly. Deviating (skip, reorder, drop) is always one tap and judgment-free. There are no "overdue" states, no red badges, no streak-breaking. The value comes from the review loop, not from adherence.

### P2. Days are made of blocks, not just tasks

Exercise and art are not tasks with checkboxes — they are recurring time blocks. A day plan is a rough sequence of blocks:

- **Focus blocks** — wrap the existing Focus Session Engine (tasks, timers, logs inside).
- **Simple blocks** — a name + duration + timer, nothing inside ("Exercise · 45m", "Art · 1h", "Lunch").

This keeps the app content-agnostic: work that happens outside a browser (hardware, art, exercise) is a first-class part of the day.

### P3. The review loop is the product

Plan → do (imperfectly) → review → adjust tomorrow. The evening review compares planned vs. actual without judgment and feeds tomorrow's plan. Over weeks, this produces the data that actually matters: how time is really spent, when energy dips, which blocks keep getting squeezed out. Plans shrink until they fit reality, then grow.

### P4. Plan smaller than feels right

Do not plan 8-hour days on day one. Sustainable 8-hour days are an *outcome* of a stabilized routine, not a starting target. The app nudges toward realistic plans: if yesterday's completion was low, suggest a lighter plan, not a heavier one.

### P5. Every feature must pass the "tomorrow morning" test

A feature ships only if it would be used tomorrow morning. Not "would be cool," not "completes the vision." This doc is deliberately thin for that reason.

---

## 3. Core Concepts

### 3.1 Day Plan

A day plan is an ordered list of blocks for a given date, plus an optional intention ("ship the auth flow", "don't skip art"). Created the night before (primary flow) or in the morning (fallback).

### 3.2 Block

| Field | Notes |
|-------|-------|
| type | `focus` or `simple` |
| name | "Deep work", "Exercise", "Art" |
| planned duration | rough, not a deadline |
| linked session | focus blocks only — created when the block starts |
| status | `planned`, `active`, `done`, `skipped` |
| actual time | logged from the timer / session engine |

Blocks are ordered, not scheduled to clock times in v0. Loose sequence beats a rigid calendar — reordering must be trivial (P1).

### 3.3 Day Review

End-of-day, optional, dismissible (same philosophy as session reflections):

- **Day timeline:** actual blocks rendered on a single-day clock timeline (from `started_at`/`ended_at`), with the planned block list beside it. This is the planned-vs-actual comparison — it shows when things really happened, what got squeezed late, when the day started and ended.
- Total time by category (focus / exercise / art / etc.).
- Mood + energy pulled from existing session logs — no re-entry.
- **Sleep (light manual log):** optional wake time + bedtime fields. Two taps, never required. Enables sleep-vs-productivity patterns once trend views exist.
- One question: **"What would make tomorrow better?"** The answer is shown when planning tomorrow.

Note the distinction that governs all timeline features: **planning to clock times is out** (rigid schedules cause abandonment — P1), but **recording and reviewing at clock times is in** (timestamps are captured automatically and cost nothing).

---

## 4. Day Lifecycle

### 4.1 Evening: plan tomorrow (~5 minutes)

- Open Today page → "Plan tomorrow."
- Yesterday's review answer ("what would make tomorrow better?") is shown at the top.
- Add blocks: pick from recent/recurring blocks (one tap for "Exercise · 45m" again) or create new ones.
- For focus blocks, optionally pre-select tasks (or leave empty and pick at session start).
- Soft warning if the plan exceeds a configurable daily budget (default: warn past ~6h of focus blocks) — per P4.

### 4.2 During the day: Today view

- **Current block** rendered large: name, timer, one primary action (start / done / skip).
- **Next block** small, below it. Remaining blocks collapsed.
- Day progress: simple bar of actual time logged vs. planned total. Neutral colors — progress, not judgment.
- Starting a focus block launches the existing session flow; the block inherits the session's actual time, logs, and summary.
- Skip and reorder are one tap from the block list. Skipped blocks are grayed, never red.
- Unplanned work: a "start unplanned block" action, so real days that diverge from the plan still get tracked (P1 — deviation is data, not failure).

### 4.3 Evening: review (~3 minutes)

As described in §3.3. Completing the review flows directly into "Plan tomorrow" — the loop closes in one sitting.

---

## 5. What This Deliberately Does NOT Do (v0)

- **No clock-time *planning*.** Blocks are an ordered list, not scheduled calendar events. Actual times are recorded and reviewed on a timeline (§3.3), but the plan itself never has clock deadlines. (Optional soft "anchors" — e.g., "exercise ~morning" — only if dogfooding demands them.)
- **No recurring plan templates / automation.** "Repeat yesterday's structure" one-tap is enough.
- **No streaks, badges, or gamification.** Adherence pressure causes abandonment (P1).
- **No trend dashboard yet.** Day-level review ships in v0; overlaying actual blocks on the existing calendar week view is the first fast-follow; a trend dashboard (time by category over weeks, sleep vs. productivity) comes once weeks of real data exist. The data model already captures everything it needs, so deferring costs nothing.
- **No journal.** Deferred per the v8 PRD until this loop is used daily.
- **No new logging system.** Mood/energy/notes reuse existing Daily Rhythm log types.
- **No mobile-specific work.** Responsive web is fine.

---

## 6. Data Model Sketch

Two new tables, both RLS-scoped by `user_id` like everything else:

```sql
day_plans
  id            uuid PK
  user_id       uuid FK
  date          date NOT NULL          -- UNIQUE (user_id, date)
  intention     text                   -- optional daily intention
  woke_at       timestamptz            -- optional, manual
  slept_at      timestamptz            -- optional, manual (bedtime ending this day)
  review_rating int                    -- 1–5, nullable
  review_better text                   -- "what would make tomorrow better?"
  reviewed_at   timestamptz

day_blocks
  id                  uuid PK
  day_plan_id         uuid FK → day_plans, ON DELETE CASCADE
  user_id             uuid FK
  block_type          text CHECK IN ('focus','simple')
  name                text NOT NULL
  position            int NOT NULL
  planned_duration_ms bigint NOT NULL
  actual_duration_ms  bigint DEFAULT 0
  status              text CHECK IN ('planned','active','done','skipped')
  session_id          uuid FK → focus_sessions, nullable  -- focus blocks
  started_at          timestamptz
  ended_at            timestamptz
```

Focus blocks derive `actual_duration_ms` from the linked session's `total_active_ms`. Simple blocks use a plain start/stop timer. No changes to existing tables.

---

## 7. v0 Scope (ship in days, not weeks)

1. Today page route with current-block view + block list.
2. Plan-tomorrow flow (add/reorder/remove blocks, recent-blocks quick add).
3. Simple block timer (start / done / skip).
4. Focus block → launches existing session flow, links session to block.
5. Day progress bar (actual vs. planned).
6. Evening review: single-day timeline of actual blocks beside the planned list, rating, optional wake/bedtime, "what would make tomorrow better?" → flows into planning tomorrow.
7. Unplanned block capture.

**Explicitly after v0 (in order):** actual-blocks overlay on the existing calendar week view, soft plan-budget warnings, "repeat yesterday" one-tap, trend dashboard (time by category, sleep vs. productivity), block categories/colors.

---

## 8. Success Criteria

Not metrics — this is a single-user tool for now. The test is behavioral:

- The plan gets made the night before at least 5 nights in the first week.
- The Today page is the first thing opened in the morning.
- Reviews get completed more often than skipped.
- After two weeks: plans are getting *more accurate* (planned vs. actual gap shrinking), not more ambitious.

If any of these fail, the fix is to *remove* friction or features, not add them.

---

## 9. Open Questions

- **Q1.** Should simple blocks support a short note on completion ("what did I make?") or does that pull toward journaling too early? Leaning: defer, mood/energy logs are enough.
- **Q2.** Where does the Today page live — new sidebar route, or replace the current landing page? Leaning: new route, make it the default landing after dogfooding confirms it earns that.
- **Q3.** Does a half-finished block (started, abandoned mid-timer) count as done, skipped, or a third state? Leaning: keep `done`/`skipped` only, log actual time either way — statuses multiply guilt.
