# Territory: Create and organize tasks

## The question

When I create, edit, move, or delete an item, what happens between the
keystroke and the database — and why does the UI feel instant?

## User-visible behavior

```
User types in quick-add (header) / list footer / project card / week-view drag
    ↓
item appears in the UI IMMEDIATELY
    ↓  (meanwhile, in the background)
row is inserted in Supabase; position assigned by the DB
    ↓
cache refetch replaces the temporary item with the real row
    ↓
item shows up in every view that includes it (board/list/projects/...)
```

Edits (status cycle, title, drag between board columns, archive) follow the
same shape: instant local change, background write, refetch.

## Entry point

There is no single entry — **five surfaces create items**, all funneling into
one hook:

| Surface | File | What it sets |
|---|---|---|
| Header quick-add | `tracker-layout.tsx:64-74` | title only |
| List footer input | `list/page.tsx:149-156` | title only |
| Projects page (per-project `t`) | `projects/page.tsx:109-118` | title + project_id |
| Session setup quick-create | `session-setup-modal.tsx:62-73` | title + status |
| Week view drag-create | `week-view.tsx:237-259` | title 'New task' + scheduled_start + duration |

All call `useCreateItem()` (`web/lib/hooks/use-items.ts:51`). Updates all go
through `useUpdateItem()` (`use-items.ts:127`), deletes through
`useDeleteItem()` (`:185`). [CODE]

## Control-flow path

```
useCreateItem().mutate(input)
    ↓ onMutate                                   use-items.ts:81-113
        cancel in-flight queries
        snapshot previous cache
        insert optimistic Item { id: `temp-${Date.now()}`, user_id: '',
                                 position: cacheLength+1, ... }
    ↓ mutationFn                                 use-items.ts:55-79
        supabase.auth.getUser()  ← extra network round-trip per mutation
        INSERT items (user_id set explicitly client-side)
        DB trigger set_item_position() assigns real position
                                                 schema.sql:307-323
    ↓ onError  → restore snapshot (optimistic item vanishes)
    ↓ onSettled → invalidate ['items'] → refetch replaces temp row
```

Update path adds business logic **inside the mutation fn**: setting status to
`done` stamps `completed_at`; any other status clears it
(`use-items.ts:135-140`), mirrored in the optimistic update (`:163-165`). [CODE]

Delete is a hard DELETE; `parent_id ... ON DELETE CASCADE`
(`schema.sql:59`) means **deleting a parent silently deletes all
descendants**. The only confirmation is a browser `confirm()` in the details
panel (`item-details-panel.tsx:157-162`); the list-view delete button has no
confirm (`list/page.tsx:343-366` per view exploration). [CODE]

## Data flow

```
CreateItemInput (partial, from whichever surface)
    ↓
optimistic Item (fake id `temp-…`, user_id '', guessed position)
    ↓ replaced after settle by
items row (real uuid, DB-assigned position, trigger-set updated_at)
    ↓ useItems() → flat Item[] ordered by position (single query, no pagination)
    ↓ per-view, per-render
buildItemTree(items) → ItemWithChildren[] (children + depth, client-side)
    ↓ list view only
flattenItemTree() → visible rows honoring expansion state
```

- `buildItemTree` (`use-items.ts:220-249`): two-pass map build; **orphans
  (parent_id pointing at a missing item) are promoted to roots** rather than
  dropped — pinned by test
  (`build-item-tree.test.ts` "promotes orphaned children"). [TEST]
- The tree is recomputed on every render in every view that needs it; only
  some views memoize. [CODE]

## State ownership

```
TanStack Query ['items']  → the single flat list every view reads
Zustand ui-store          → which item is selected/focused/expanded/editing
Supabase items table      → durable truth; position/updated_at DB-assigned
```

Notable split: **hierarchy is stored flat (parent_id) and materialized
client-side per render**; the DB never computes the tree. Expansion state
(`expandedItemIds`) is one shared Set used by both list and projects views —
expanding in one changes what the other's keyboard walker sees
(view-layer exploration, `ui-store.ts:23-24`). [CODE]

## Side effects and boundaries

- Supabase PostgREST for every mutation, plus a `supabase.auth.getUser()`
  **network** call before each query/mutation (19 sites across hooks) even
  though AuthProvider already holds the user. [CODE]
- DB triggers: `set_item_position` (append within user+parent scope),
  `update_updated_at`. Position is the *only* field whose truth is DB-side
  at insert. [CODE]
- PostgREST `max_rows` defaults to 1000 and `useItems()` has no `.limit()`
  or pagination — silent truncation past 1000 items. [CODE→INFERRED]

## Decisions embodied by the code

**Decision:** One flat all-items query + client-side tree building, instead
of per-view or per-parent queries.
**Evidence:** `use-items.ts:12-29`, `buildItemTree :220`.
**Consequence:** Every view is instantly consistent from one cache entry;
optimistic updates are trivial (edit one array). Whole dataset refetches on
any invalidation.
**Possible alternative:** Server-side tree (recursive CTE), paginated or
per-status queries.
**Trade-off:** Simplicity and snappiness for a solo user's data size; won't
scale past ~1000 rows (hard cap) and refetch cost grows linearly.

**Decision:** Optimistic updates with client-fabricated temp IDs.
**Evidence:** `use-items.ts:86-106` (`temp-${Date.now()}`).
**Consequence:** Zero perceived latency. But until settle, the item's id is
fake: clicking it (details panel does a by-id server query,
`use-items.ts:32-48`) or adding it to a session would reference a
nonexistent row. [INFERRED]
**Possible alternative:** Client-generated real UUIDs (`crypto.randomUUID()`
inserted as the actual id) — removes the temp-id window entirely.

**Decision:** `completed_at` lifecycle lives in the client mutation hook,
not a DB trigger.
**Evidence:** `use-items.ts:135-140`.
**Consequence:** Any write path bypassing `useUpdateItem` (e.g. the
session-end write-back in `use-focus-sessions.ts:210-217`, which sets
`status: 'done'` directly) does **not** stamp `completed_at`. Two paths, two
behaviors. [CODE]

**Decision:** Archive is a status (`archived`), delete is physical.
**Evidence:** `types/index.ts:3`; archive drop-zone `board/page.tsx:124-131`;
restore hardcodes `status:'todo'` (`archive/page.tsx:86-88`).
**Consequence:** Archived children become invisible everywhere (archive page
filters `!parent_id`; other views filter archived out; projects page leaks
them into counts — see view exploration §8.2). [CODE]

## Invariants and assumptions

- `position` is unique-ish per (user, parent) only by trigger convention —
  no DB constraint; concurrent inserts could duplicate positions
  (`schema.sql:307-323`). [INFERRED]
- Views assume `parent_id` cycles don't exist; `buildItemTree` would drop a
  cycle's members from roots silently (each waits for its parent).
  Nothing prevents setting an item's parent to its own descendant. [INFERRED]
- `project_id` must be a valid UUID or null — violated by the Unassigned
  card's `handleCreateTask('unassigned')` (`projects/page.tsx:554`), which
  fails at insert and rolls back the optimistic row. [CODE]

## Failure modes

- **Mutation fails after optimistic apply** → snapshot restore works, but any
  UI state referencing the temp id (selection, focus) now points at nothing.
- **Temp-id interactions** during the settle window (details panel by-id
  query fails). [INFERRED]
- **Concurrent edits, last-write-wins**: updates are field-patches with no
  version check; two tabs can silently clobber each other. [CODE]
- **Cascade delete surprise**: deleting a parent with a large subtree has no
  "this will delete N children" warning. [CODE]

## Tests and verification

- `build-item-tree.test.ts` — tree construction thoroughly pinned (nesting,
  depth, orphan promotion, position sorting, input immutability). [TEST]
- `ui-store.test.ts` — selection/expansion semantics, including the
  deliberate "closeDetailsPanel preserves selectedItemId" behavior. [TEST]
- **Untested:** every mutation hook (optimistic apply/rollback), every view
  render, keyboard handlers, drag-and-drop. [CODE]

## Visual map

```
 5 create surfaces ──┐
 status cycles/drags ─┼──► use-items.ts hooks ──► Supabase items
 details panel edits ─┘         │   ▲                  │ triggers:
                     optimistic │   │ invalidate       │  position,
                                ▼   │                  │  updated_at
                        Query cache ['items']  ◄───────┘
                                │
                    buildItemTree() per view render
                                │
        board (roots by status) │ list (flat tree w/ expansion)
        projects (per-project)  │ calendar (by due_date)
        week view (by scheduled_start)   archive (archived roots)
```

## Fog

- ? What actually happens if you click an optimistic (temp-id) item before
  the insert settles?
- ? Can you create a parent cycle via the details panel's project/parent
  editing paths, and what would each view render if you did?
- ? Two tabs editing the same item — is last-write-wins acceptable here, or
  should `updated_at` be checked?
- ? Why is `completed_at` client-managed instead of a trigger, given
  `updated_at` IS a trigger?
- ? The optimistic position guess is `cacheLength + 1` while the trigger
  scopes position to (user, parent) — do newly created subtasks briefly sort
  wrong?
- ? Is the 1000-row PostgREST cap a real ceiling for the app's design, and
  what breaks first when it's hit?
- ? `start_date` exists on items (`types/index.ts:18`) — what reads it?
  (Nothing found in views exploration.) [UNKNOWN]

## Suggested walk

1. Read `use-items.ts` top to bottom — it's the whole persistence pattern in
   one file; every other hook family is a variation of it.
2. Before reading `onMutate`, predict how the UI can show an item that has
   no database id yet.
3. Read `schema.sql:56-95` (items table) and `:307-323` (position trigger).
   Ask: which fields does the client control vs the DB?
4. Read `buildItemTree` and its test file side by side.
5. Pick one create surface (quick-add, `tracker-layout.tsx:64`) and follow
   input → hook → cache → the board view rendering it.
6. Find the session-end write-back (`use-focus-sessions.ts:203-218`) and
   note it bypasses this hook entirely.

## Ownership challenge

Replace temp IDs with real client-generated UUIDs (`crypto.randomUUID()`
passed into the INSERT), removing the temp-id window. Then fix the
Unassigned card's `handleCreateTask('unassigned')` bug — the two changes
touch the same create path from opposite ends.
