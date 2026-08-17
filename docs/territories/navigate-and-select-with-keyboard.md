# Territory: Navigate and select with the keyboard

## The question

When I press a key, which of the several listening handlers wins, where does
"the currently focused item" actually live, and why does each view feel
slightly different?

## User-visible behavior

```
Global (any view):  n quick-add · ? help · 1-6 switch view · t timer
    ↓ plus, per view
arrow keys move a highlight through items
Enter/→ opens the details panel (or toggles expansion — view-dependent)
← closes the panel and restores previous focus
view-specific keys: e edit (list) · s subtask, t task (projects) · [ ] t w (calendar)
    ↓ during a focus session
Space/d/k/b/l/+/Esc are captured by the session view instead
```

## Entry point

**There is no keyboard system — there are seven independent `window`
keydown listeners**, one per surface, all mounted simultaneously with the
layout's global one:

- Global: `tracker-layout.tsx:77-112`
- Per view: `board/page.tsx:63-96`, `list/page.tsx:73-139`,
  `calendar/page.tsx:140-179`, `projects/page.tsx:161-344`,
  `archive/page.tsx:50-84`
- Session: `active-session-view.tsx:287-342`
- Setup modal Escape: `session-setup-modal.tsx:175-183`

None call `stopPropagation` between layout and page handlers — **both always
run for the same event**. [CODE — view exploration §3d]

## Control-flow path (the shape, using projects as the richest case)

```
window keydown
    ↓ input guard: skip if target is INPUT/TEXTAREA/(sometimes contenteditable)
    ↓ projects builds focusableItems[] — a flat walk of
      [create-project, project, its expanded items…, …, unassigned]
      REBUILT EVERY RENDER, in the effect deps → listener re-registers
      every render                                   projects/page.tsx:121-158,344
    ↓ ArrowDown/Up: find current index in focusableItems, move ±1
      (down wraps, up clamps — asymmetric)                     :189-269
    ↓ Enter: toggle expansion   → ui-store expandedItemIds/ProjectIds
    ↓ ArrowRight: snapshot focus into a ref, openDetailsPanel  :279-290
    ↓ ArrowLeft: close panel, restore snapshot                 :291-302
```

Every view independently re-implements this pattern; board/archive/calendar
arrow blocks are near-identical copies, and each view keeps its own
`lastFocusBeforeDetailsPanelRef` (5 copies). [CODE]

## State ownership

```
ui-store (Zustand, global, never reset on route change)
  ├── focusedItemId / focusedProjectId    ← keyboard highlight
  ├── selectedItemId + isDetailsPanelOpen ← details panel target
  ├── expandedItemIds (SHARED between list & projects views)
  └── activeTimer* fields                 ← written by TimerProvider
React refs / local state (per view)
  ├── lastFocusBeforeDetailsPanelRef ×5   ← focus restore snapshots
  └── isCreateProjectFocused (projects)   ← the ONE focus concept kept
                                            OUT of the store
```

Known dead store API (written or defined, never read):
`currentView`, `isQuickAddFocused`, `setSelectedItemId`, `expandItem`,
`collapseItem`, `expandProject`, `collapseProject`, `activeTimerStartedAt`
(read side). The tests in `ui-store.test.ts` cover even the dead actions,
which makes the store look more load-bearing than it is. [CODE][TEST]

## Side effects and boundaries

- All handlers are raw `window.addEventListener` — no library, no focus
  management beyond the details panel's manual Tab trap
  (`item-details-panel.tsx:60-89`).
- Mouse hover **also** writes `focusedItemId` in every view, so moving the
  mouse silently moves the keyboard cursor. [CODE]

## Decisions embodied by the code

**Decision:** Keyboard focus is global app state (ui-store), not per-view
state.
**Evidence:** `ui-store.ts:44-47`; no view resets focus on unmount.
**Consequence:** Focus survives view switches — arrow keys on a fresh view
start from a stale foreign item; the `findIndex → -1` fallbacks make
ArrowDown land at index 0 but ArrowUp land at the end. [CODE]
**Possible alternative:** Reset focus on route change, or per-view focus.

**Decision:** Each view owns its complete key map; no shared registry.
**Evidence:** the seven listeners above; the help popup mirrors this with
per-view `SHORTCUTS` constants passed to `keyboard-shortcuts-help.tsx`.
**Consequence:** Semantics drifted: Enter opens the panel on board/
calendar/archive but toggles expansion on list/projects; `t` means timer
(global) AND add-task (projects) AND today (calendar) — on /projects both
handlers fire for one keypress, starting a timer *and* opening the add-task
input. [CODE — view exploration §3d]
**Trade-off:** Each view is self-contained and easy to read alone; the
system as a whole has no single place to see or resolve conflicts.

**Decision:** `closeDetailsPanel` deliberately preserves `selectedItemId`.
**Evidence:** `ui-store.ts:71-72`; pinned by
`ui-store.test.ts` "closeDetailsPanel only closes the panel". [TEST]
**Consequence:** The global `t` shortcut falls back to
`focusedItemId || selectedItemId` (`tracker-layout.tsx:99`) — pressing `t`
with nothing visibly focused can start a timer on the last item you opened,
possibly in another view. Intended feature or frozen accident: [UNKNOWN].

## Invariants and assumptions

- Only one page-level listener is mounted at a time (Next unmounts the old
  page) — the collisions are layout-vs-page, not page-vs-page. [CODE]
- Input guards assume all typing happens in INPUT/TEXTAREA; the layout's
  guard omits contenteditable while projects' includes it — a
  contenteditable would leak global shortcuts. [CODE]
- The projects walker assumes `focusableItems` order matches visual order;
  it's rebuilt from render data each time, so this holds — at the cost of
  re-registering the listener every render. [CODE]

## Failure modes

- `t` double-fire on /projects (timer + add-task). [CODE]
- Stale cross-view focus producing asymmetric arrow behavior. [CODE]
- Week view (the *default* calendar mode) has no keyboard support at all,
  while the calendar help popup advertises month-mode keys unqualified. [CODE]
- Hover-vs-keyboard fights: browsing with keys while the mouse rests over a
  card snaps focus back to the hovered card on any pointer jitter. [INFERRED]

## Tests and verification

- `ui-store.test.ts` — store semantics only. [TEST]
- **No test dispatches a real KeyboardEvent**; every handler, guard, and
  collision is unverified. [CODE]

## Visual map

```
            window keydown ──────────────┬──────────────┐
                                         ▼              ▼
                            tracker-layout handler   current page handler
                            (n ? 1-6 t)              (arrows, Enter, view keys)
                                         │              │  no stopPropagation:
                                         └──── BOTH RUN ┘  same event
                                                │
                     ┌─────────── ui-store ─────┴────────────┐
                     │ focusedItemId  selectedItemId          │
                     │ expandedItemIds  isDetailsPanelOpen    │
                     └───────────────┬────────────────────────┘
                                     ▼
                         views render highlight;
                         ItemDetailsPanel (tracker-layout:201)
```

## Fog

- ? Is the `t` collision on /projects known? Which binding should win?
- ? Should focus reset on route change, or is cross-view persistence a
  feature?
- ? Enter-opens vs Enter-expands: deliberate split by "view has hierarchy",
  or drift?
- ? Why is `isCreateProjectFocused` local state when every sibling focus
  concept is in the store?
- ? Half the ui-store API is dead — is `currentView` a planned refactor
  (store-driven routing) or removable?
- ? The projects listener re-registers on every render (unmemoized
  `focusableItems` in deps) — measurable cost or noise?
- ? Why does the help popup unconditionally show focus-session shortcuts on
  every view (`keyboard-shortcuts-help.tsx:39`)?

## Suggested walk

(Good 15–30 min exercise; the smallest complete instance is the archive page.)

1. Read `archive/page.tsx:50-84` — the whole per-view pattern in 35 lines.
2. Read `tracker-layout.tsx:77-112` and list which keys overlap with any
   view's handler.
3. Open `/projects` in the running app, focus an item, press `t`, and watch
   both effects happen.
4. Read `ui-store.ts` completely, marking each field as
   live / dead / write-only using the table in the views exploration.
5. Read the details panel's Tab trap (`item-details-panel.tsx:60-89`) —
   predict what happens when the panel closes while an element inside had
   focus.

## Ownership challenge

Pick one: (a) resolve the `t` collision (suppress the layout's timer
binding when the page has its own `t`, or namespace the bindings); or
(b) extract the copied arrow-navigation block (board/archive/calendar
variants) into one shared hook and delete the three copies — behavior
should be provably unchanged for board and archive, and you'll have to
decide what "unchanged" means for calendar's off-screen-focus quirk.
