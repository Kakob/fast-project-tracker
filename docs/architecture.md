# Architecture

Floviate is a Next.js + Supabase task tracker with Kanban, list, monthly calendar, weekly time-blocking, and a structured focus-session mode. This document describes the load-bearing components in roughly the order a reviewer is most likely to ask about them.

---

## 1. Database schema and row-level security

**Files:** `supabase/schema.sql`, `supabase/migrations/*.sql`

The Postgres database is the source of truth for everything the app does. The schema is enforced and extended by `CREATE POLICY` statements that scope every row to `auth.uid()`, by `CHECK` constraints that lock down enum-like columns (status, priority, color, session status, reminder trigger types), and by `plpgsql` triggers that compute defaults (`position`, `updated_at`) and run a per-user bootstrap on signup.

**Mechanism.** The core `items` table is self-referential (`parent_id UUID REFERENCES items(id) ON DELETE CASCADE`) so tasks form a forest of arbitrary depth. Calendar scheduling lives on the same row (`scheduled_start TIMESTAMPTZ`, `duration_minutes INT`), as does focus-session aggregation (`cumulative_time_ms`, `session_count`, `intention`). Cascading deletes propagate from `profiles` (which mirrors `auth.users.id`) all the way down. A `BEFORE INSERT` trigger (`set_item_position`) assigns `position = MAX(position)+1` scoped by `(user_id, parent_id)`, giving each sibling group its own contiguous integer ordering. `handle_new_user()` runs `AFTER INSERT ON auth.users` with `SECURITY DEFINER`: it inserts the matching profile and seeds three default `log_types` (Mood, Energy, Notes) so the focus-session UI has something to render the first time a user opens it.

RLS is enabled on every user-owned table. Direct-ownership tables (`items`, `projects`, `time_entries`, `focus_sessions`, `reminders`, etc.) use `auth.uid() = user_id`. `session_tasks` uses an `EXISTS` subquery against `focus_sessions` so a malicious client cannot bypass session ownership by inserting orphan task rows. `log_entries` has only `SELECT`/`INSERT` policies — no update or delete — making it append-only at the database layer.

**Talks to:** Supabase Auth (via `auth.users` FK + `auth.uid()` in policies); the web client through PostgREST.

---

## 2. Server-state layer with optimistic updates

**Files:** `web/lib/hooks/use-items.ts`, `web/lib/hooks/use-time-entries.ts`, `web/lib/hooks/use-focus-sessions.ts`, `web/lib/hooks/use-session-tasks.ts`, `web/lib/hooks/use-reminders.ts`, `web/lib/hooks/use-projects.ts`, `web/app/providers.tsx`

Every mutation in the app is wrapped in a TanStack Query mutation that updates the cache before the network call resolves, then reconciles on settle. This is what makes the UI feel instant despite a round-trip to Supabase on every change.

**Mechanism.** Each domain has a `queryKey` factory (e.g. `itemKeys.all`, `focusSessionKeys.active`, `timeEntryKeys.byItem(id)`) so multiple hooks share cache entries. Mutations follow a strict four-phase pattern: `onMutate` cancels in-flight queries with `queryClient.cancelQueries`, snapshots the previous data, and writes an optimistic value (e.g. an `Item` with `id: "temp-${Date.now()}"`); `mutationFn` calls Supabase; `onError` restores the snapshot from `context.previousItems`; `onSettled` invalidates the affected keys so the server response replaces the optimistic state. The `QueryClient` is created once per app mount inside `Providers` with `staleTime: 60_000` and `refetchOnWindowFocus: false` to suppress jitter. `useEndFocusSession` does a multi-query cross-invalidation (`focusSessionKeys.all`, `focusSessionKeys.active`, `itemKeys.all`) because ending a session writes back cumulative time to `items` via an `increment_item_session_stats` RPC (with a manual `SELECT … UPDATE` fallback if the RPC is missing).

**Talks to:** `supabase-client.ts` for the singleton client; Zustand stores read these caches indirectly through the components that compose them.

---

## 3. Focus session engine

**Files:** `web/components/focus/focus-session-provider.tsx`, `web/lib/stores/focus-session-store.ts`, `web/components/focus/active-session-view.tsx`, `web/lib/hooks/use-focus-sessions.ts`

A single mounted `<FocusSessionProvider />` runs the entire session clock for the app — task timing, warning zone, auto-advance to the next task, break timer, and interval reminders — without rendering anything itself. The UI subscribes via Zustand selectors.

**Mechanism.** When `useActiveFocusSession()` returns a row with `status === 'active'` and a `started_at`, the provider opens a `setInterval(1000)`. The tick handler computes `sessionElapsed = Date.now() - startedAt - (total_pause_ms + total_break_ms)` — wall-clock based, so a tab going to sleep does not desynchronize the timer. Per-task elapsed is derived by subtracting `taskStartSessionElapsedMs` (captured at the moment the task became active). Two `useRef` sentinels (`warningFiredForTaskRef`, `autoAdvancedForTaskRef`) gate the once-per-task side effects: when `remaining <= warning_buffer_sec * 1000` the provider sets `isWarningActive` and plays a 800 Hz sine pulse through a lazily-constructed `AudioContext`; when `taskElapsed >= allocated + extensions`, it marks the current `session_task` as `paused_incomplete`, calls `enterTransition` to display a 4-second TaskTransition overlay, then advances the current task index and marks the next task `active` with `started_at = now`. A separate interval drives the break timer and auto-ends a break once its `planned_duration_sec` is hit. The interval-reminder loop reschedules its `setTimeout`s on every state change: it filters reminders by source (`global`, `session`, or `task` matching the current task), computes the next firing aligned to `Math.ceil((elapsed + 1) / interval) * interval`, and pushes the matched reminder into `pendingReminderPrompt` so a toast can render.

All callbacks in `ActiveSessionView` read fresh state through `useFocusSessionStore.getState()` rather than React props to avoid stale closures across the long-lived keyboard handlers (space, d, k, b, l, +, Escape).

**Talks to:** `focus_sessions`, `session_tasks`, `reminders`, `breaks`, and `items` via the corresponding TanStack hooks; the audio output through the Web Audio API.

---

## 4. Hierarchical item tree

**Files:** `web/lib/hooks/use-items.ts` (`buildItemTree`, `flattenItemTree`)

The database stores items flat with a `parent_id` self-reference; the UI needs a nested tree with depth annotations for indentation in the list view and for the board's child-count badge. The conversion happens client-side on every render of `useItems()` consumers.

**Mechanism.** `buildItemTree` is a two-pass O(n) algorithm. Pass one creates a `Map<id, ItemWithChildren>` so children can be attached in any order without re-scanning the array. Pass two iterates again and, for each item with a parent whose node exists in the map, pushes the node into its parent's `children` array and sets `node.depth = parent.depth + 1`; items whose parent is missing (or null) are added to the root array. Because parents may appear after children in the input, both passes are required. A final recursive `sortChildren` sorts each level by `position`, preserving the manual ordering maintained by the database `set_item_position` trigger. `flattenItemTree` produces a depth-first traversal so the list view can render the tree as a single mappable array while keeping `depth` for left-padding.

**Talks to:** `useItems()` flat list (the input); `ListPage` for rendering; `BoardPage` for child counts.

---

## 5. Week view calendar

**File:** `web/components/views/week-view.tsx`

A Google-Calendar-style 7-day grid with click-and-drag event creation, drag-to-move, drag-to-resize, and side-by-side layout for overlapping events. There is no calendar library — the entire interaction is hand-rolled mouse math.

**Mechanism.** The grid is `24 * 60 = 1440` pixels tall (`HOUR_HEIGHT = 60`, i.e. one pixel per minute). All time math is in "minutes since midnight." Snapping uses `snap()` (round to 15 min) or `floorSnap()` (floor to 15 min) — create-drag uses floor-snap so the slot you click in is the slot the event starts in, while move-drag uses round-snap. Drag state is a discriminated union (`move | resize | create`) with kind-specific origin data. A `mousemove` handler on `window` computes a `PreviewState` block that renders as a dashed ghost; on `mouseup` the matching `updateItem` or `createItem` mutation fires (writing `scheduled_start` or `duration_minutes`). Create-drag distinguishes click-vs-drag via `createDragMovedRef` so a bare click produces a default 30-minute event.

Overlap handling is in `layoutLanes`. Events are sorted by `(startMin, endMin)`, then walked into clusters bounded by a moving `clusterEnd`. Within a cluster, each event is placed in the lowest-index lane whose previous end is `<= ev.startMin` — a standard interval-graph greedy coloring. After a cluster is closed, every event in it is stamped with `totalLanes = lanes.length`, which the renderer turns into `width: calc(100% / totalLanes)` and `left: calc(lane * width)`.

**Talks to:** `useItems`, `useCreateItem`, `useUpdateItem`; the parent CalendarPage for week navigation; `ui-store` for opening the details panel on click.

---

## 6. Authentication and session sync

**Files:** `web/lib/auth-context.tsx`, `web/lib/supabase-client.ts`, `web/app/sign-in/page.tsx`, `web/app/auth/callback/page.tsx`, `web/app/(tracker)/layout.tsx`

Supabase Auth provides email magic link and Google OAuth. The React side keeps the session in context and gates the entire `(tracker)` route group on its presence.

**Mechanism.** `AuthProvider` calls `supabase.auth.getSession()` once on mount to hydrate, then subscribes to `supabase.auth.onAuthStateChange` so that token refreshes and sign-outs propagate without a reload; it unsubscribes on unmount. The Supabase JS client persists the session to `localStorage` automatically, so refreshes and new tabs pick it up. The sign-in page calls `signInWithOtp({ email, options: { emailRedirectTo: …/auth/callback } })` or `signInWithOAuth({ provider: 'google', … })`. The `/auth/callback` page lets the JS client finalize the URL fragment, then `SELECT`s the user's profile and inserts a row if it is missing — this is the defensive fallback for the `handle_new_user` trigger and also catches OAuth users whose metadata was not seen at signup. The `(tracker)` layout reads `useAuth()` and redirects to `/sign-in` if the session is absent, blocking the entire app surface until authenticated.

**Talks to:** Supabase Auth (`supabase.auth.*`), the `profiles` table for the post-callback ensure-row write.

---

## 7. UI state store

**File:** `web/lib/stores/ui-store.ts`

Zustand store for cross-component UI state that is not server-derived: selection, expansion, focus, view name, and the active-timer ticking display.

**Mechanism.** A single `create()` call produces a flat slice with action methods. Expanded items and projects are `Set<string>` values mutated by allocating a new Set inside `set((state) => …)` so React sees a new reference. The store mirrors the active timer (`activeTimerItemId`, `activeTimerStartedAt`, `timerElapsedSeconds`) — `TimerProvider` watches `useActiveTimeEntry()`, starts a 1 Hz interval that computes `(Date.now() - startedAt) / 1000`, and writes the value here so any component (e.g. the global indicator, per-row timer buttons) can render the live count without owning the interval. The `autoClearTitleItemId` field is a one-shot flag set by WeekView after creating a placeholder event so the details panel knows to clear "New task" on first focus.

**Talks to:** Almost every component; `TimerProvider` for live updates; `tracker-layout` for global keyboard shortcuts (`n`, `?`, `1`–`6`, `t`).

---

## 8. Single-running-timer invariant

**File:** `web/lib/hooks/use-time-entries.ts`

There is at most one row in `time_entries` with `ended_at IS NULL` per user — the currently running stopwatch. This invariant is maintained client-side because the database does not enforce a partial unique constraint on it.

**Mechanism.** `useStartTimer` first issues `SELECT … WHERE user_id = $1 AND ended_at IS NULL LIMIT 1`. If a row exists, it computes `duration_seconds` from `started_at` and patches the row with `ended_at = now`, then inserts the new entry. `useStopTimer` finds and closes the running row the same way. `useActiveTimeEntry` is a TanStack query that returns at most one row; its key (`timeEntryKeys.active`) is what `TimerProvider` watches to drive the live tick. The `idx_time_entries_user_running` partial index (`WHERE ended_at IS NULL`) makes the "find running" lookup constant-time. Stopping a timer also writes `duration_seconds` so reports can sum a single column instead of subtracting two timestamps per row.

**Talks to:** `time_entries` table; `TimerProvider` and the UI store's timer slice; `TimerButton` in board and list rows.

---

## 9. App Router layout and routing

**Files:** `web/app/layout.tsx`, `web/app/providers.tsx`, `web/app/(tracker)/layout.tsx`, `web/components/tracker-layout.tsx`, `web/app/(tracker)/{board,list,calendar,projects,archive,focus}/page.tsx`

Next.js App Router with a route group `(tracker)` that wraps all authenticated views in a shared shell containing the nav, quick-add input, timer indicator, focus-session indicator, details panel, and the two singleton providers.

**Mechanism.** The root `layout.tsx` only mounts `<Providers>` (which composes `AuthProvider` and `QueryClientProvider`). The `(tracker)` route group is purely organizational — it does not appear in URLs — and its `layout.tsx` enforces auth then renders `<TrackerLayout>`. `TrackerLayout` derives the active tab from `usePathname()`, owns the global keyboard shortcut handler, and mounts `<TimerProvider />` and `<FocusSessionProvider />` exactly once so their intervals do not multiply across route changes. The details panel and focus-session setup modal are conditionally rendered here so they overlay any view. Each `page.tsx` is a client component that calls TanStack hooks for its data, the UI store for shared interaction state, and registers its own keyboard shortcuts.

**Talks to:** All visible state stores and hooks; provides the single mount point for the interval-owning providers.

---

## 10. Tech summary

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Lucide icons.
- **State:** Zustand for UI and focus-session state; TanStack Query v5 for server state with optimistic mutations.
- **Backend:** Supabase Postgres with row-level security, plpgsql triggers and an `auth.users` signup hook; Supabase Auth (magic link + Google OAuth); PostgREST for the data plane.
- **Testing:** Vitest with jsdom and React Testing Library (`web/__tests__`).
