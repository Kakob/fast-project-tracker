# Territory: Sign in and own your data

## The question

How does a browser session become an authenticated user, and what actually
stops one user from reading another's rows — the React redirects or the
database?

## User-visible behavior

```
Visit / → spinner → redirected to /sign-in (or /board if signed in)
    ↓
enter email → "check your email" message      OR   click Google
    ↓ (leave tab, click emailed link)               ↓ (Google consent)
land on /auth/callback → brief spinner
    ↓
redirected to /board; session persists across reloads and tabs
```

Sign out (header button) → back to /sign-in.

## Entry point

- `web/app/sign-in/page.tsx` — `handleEmailSignIn` (`:14`,
  `signInWithOtp`) and `handleGoogleSignIn` (`:43`, `signInWithOAuth`).
- `web/app/auth/callback/page.tsx` — where both flows land.
- `web/lib/supabase-client.ts:14` — the module-scope singleton
  `createClient(url, anonKey)` with **no options**: all defaults, including
  `flowType: 'implicit'`, `persistSession: true` (localStorage),
  `detectSessionInUrl: true`. [CODE]

## Control-flow path

```
signInWithOtp / signInWithOAuth
    ↓ emailRedirectTo/redirectTo = `${window.location.origin}/auth/callback`
    ↓ (external: email link or Google redirect, tokens in URL HASH — implicit flow)
/auth/callback page mounts
    ↓ supabase.auth.getSession()          callback/page.tsx:13
      — no exchangeCodeForSession; works ONLY because implicit flow +
        detectSessionInUrl parse the hash during client init [CODE]
    ↓ SELECT profiles WHERE id = user.id
    ↓ if missing → INSERT profile (client-side duplicate of the DB's
      handle_new_user() trigger, but WITHOUT seeding log_types) :23-32
    ↓ router.push('/board')  (any failure → '/sign-in', silently)
```

App-side session awareness: `web/lib/auth-context.tsx` — one
`getSession()` on mount + `onAuthStateChange` subscription feeding a
context `{ session, user, isLoading }`. [CODE]

Route protection: **client-only.** No middleware, no API routes, no server
data fetching (only `app/layout.tsx` is a server component). The
load-bearing guard is `(tracker)/layout.tsx:30-32` — `if (!session) return
null` prevents child pages (and their queries) from mounting. [CODE]

## Data flow

```
Supabase Auth (hosted)
    ↓ JWT (access + refresh) in localStorage ('supabase.auth.token')
supabase-js singleton attaches Authorization: Bearer <token> automatically
    ↓ every PostgREST request
Postgres RLS evaluates auth.uid() per row
```

Before nearly every query/mutation the hooks also call
`supabase.auth.getUser()` — **a network call validating the JWT** — at 19
call sites, even though AuthProvider already holds the user (no hook
consumes `useAuth()`). [CODE]

## State ownership

```
localStorage        → tokens (library-managed, no app code touches it)
AuthProvider state  → session/user for route guards only
Supabase Postgres   → all application data, 12 tables, RLS on every one
```

RLS coverage (verified table-by-table): all 12 tables enabled; most use
`auth.uid() = user_id` for S/I/U/D. Notable asymmetries: [CODE]

- `session_tasks` has **no user_id column** — ownership enforced via
  `EXISTS (… focus_sessions … user_id = auth.uid())` on every operation.
- `log_entries`: SELECT + INSERT only → **append-only at the DB layer**.
- `session_reflections` and `breaks`: no DELETE policy (rows removable only
  via cascade from `focus_sessions`).
- `user_id` is always set **explicitly client-side** on inserts; no
  `DEFAULT auth.uid()` anywhere.

## Side effects and boundaries

- Network: Supabase Auth endpoints; PostgREST for data; the per-hook
  `getUser()` round-trips.
- Browser: localStorage (tokens), full-page redirects (OAuth).
- Sign-out (`tracker-layout.tsx:59-62`) does **not** clear the TanStack
  Query cache — previous user's data stays in memory until remount. [CODE]

## Decisions embodied by the code

**Decision:** Security lives entirely in RLS; the React guards are UX.
**Evidence:** no middleware/server fetching; RLS on 12/12 tables.
**Consequence:** Shipping the JS bundle to an unauthenticated visitor is
harmless; any data request fails at PostgREST. Correctness of *every* data
access depends on the policies being right.
**Trade-off:** Simple mental model; no server-side rendering of data ever.

**Decision:** Implicit-flow auth with a passive callback page.
**Evidence:** default client options; `callback/page.tsx:13` (getSession
only, no code exchange).
**Consequence:** Works while Supabase issues hash-token links. If the
project ever issues PKCE `?code=` links (increasingly the hosted default,
and the installed auth-js has drifted to 2.89 vs the pinned ^2.38), the
callback silently bounces to /sign-in with no error. [CODE→INFERRED]

**Decision:** Profile creation is belt-and-braces: DB trigger
(`handle_new_user`, SECURITY DEFINER) + client-side fallback insert.
**Evidence:** `schema.sql:433-457`; `callback/page.tsx:23-32`.
**Consequence:** The two paths are NOT equivalent — the trigger seeds three
default `log_types` (Mood/Energy/Notes); the client fallback does not. A
user bootstrapped by the fallback has an empty logging UI. [CODE]

**Decision:** Per-operation `getUser()` + redundant `.eq('user_id', …)`
filters on list reads, while by-id reads/writes rely on RLS alone.
**Evidence:** 19 `getUser()` sites; filters in `use-items.ts:22` etc.;
no user filter in `use-items.ts:40,145,193`.
**Consequence:** Extra latency per operation; the inconsistency proves RLS
is the real boundary. [CODE]

## Invariants and assumptions

- `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` must exist at build/boot — the client
  module throws at import time (`supabase-client.ts:6-12`). [CODE]
- Every insert assumes the client sends the correct `user_id`; RLS
  `WITH CHECK` is what makes lying impossible. [CODE]
- The app talks to a **hosted** Supabase project (`web/.env.local`), while
  `supabase/config.toml` describes a local stack (port 3000 site URL,
  Google disabled, project_id "winfeed") that the running app never uses.
  [CODE]

## Failure modes

- PKCE link → silent sign-in loop (see decision above). [INFERRED]
- Fallback-created profiles missing log_types. [CODE]
- Stale query cache across sign-out/sign-in as a different user. [INFERRED]
- Magic-link `emailRedirectTo` follows `window.location.origin` — on LAN
  testing (`dev -H 0.0.0.0`, get-ip.sh) links target whatever IP:3004 you
  used, which must be in the Supabase redirect allow-list. [CODE→INFERRED]

## Known disagreements (do not silently resolve)

- **schema.sql vs migrations**: the 4 columns
  `default_warning_buffer_sec`, `default_break_duration_sec`,
  `preferred_time_increments`, `tier` are on **profiles** in the migration
  (`20260406…sql:15-20`) but pasted into **projects** in `schema.sql:42-46`.
  TypeScript types side with the migration (`Profile` has them, `Project`
  doesn't). schema.sql appears wrong; nothing reads these columns yet, so
  the bug is latent. [CODE]
- **Provisioning story**: `schema.sql` says "Run with: supabase db reset",
  but the CLI's reset runs `migrations/` — and migrations never CREATE
  `profiles`/`items`. Neither file alone can build the DB from empty; how
  the hosted DB was actually provisioned is [UNKNOWN].
- **CLAUDE.md** still says "Two tables with RLS" and port 3000; reality is
  12 tables and port 3004. [DOC vs CODE]
- `@supabase/auth-helpers-nextjs` is declared in package.json and imported
  by **zero** files — vestigial (and deprecated upstream). [CODE]

## Visual map

```
Browser                       Supabase (hosted)
───────                       ─────────────────
/sign-in ── signInWithOtp ──► Auth ── email ──► user clicks link
                                                   │ tokens in #hash
/auth/callback ◄───────────────────────────────────┘
   getSession() ── profile check/insert ── push /board

Every data call:
hooks ── getUser() [network] ──► Auth
      ── PostgREST + Bearer JWT ──► RLS: auth.uid() = user_id ──► rows

Guards: app/page.tsx + (tracker)/layout.tsx  (client redirects, UX only)
Truth:  RLS policies                          (security boundary)
```

## Fog

- ? Does sign-in still work end-to-end on auth-js 2.89 (implicit vs PKCE)?
  Test with a fresh incognito magic link.
- ? Is the client-side profile insert ever reached in practice, or is it
  dead code behind the trigger? (If reached: users with no log types.)
- ? Which reflects the live hosted schema — schema.sql or migrations —
  and where do the 4 preference columns actually live in production?
- ? Why request Google `access_type: 'offline'` + `prompt: 'consent'` when
  nothing uses the refresh token?
- ? Should sign-out clear the query cache?
- ? Was per-hook `getUser()` chosen deliberately (revalidate JWT per op) or
  is it a copy-paste pattern? What's the latency cost per page load?

## Suggested walk

1. Read `supabase-client.ts` (17 lines), then list the client defaults it
   inherits — that's most of the auth behavior.
2. Read `sign-in/page.tsx` and `auth/callback/page.tsx`; before the
   callback, predict how the tokens get from the URL into storage.
3. Read `auth-context.tsx` and both guards (`app/page.tsx`,
   `(tracker)/layout.tsx:16-34`). Ask: what does each guard actually protect?
4. Read the RLS section of `schema.sql:462-605` for two tables: `items`
   (direct ownership) and `session_tasks` (ownership by join).
5. Pick one hook and count its round-trips per mutation (getUser + op).

## Ownership challenge

Remove the per-operation `getUser()` round-trip: have hooks read the user
from `useAuth()` (or `getSession()`, which is local), keeping the
"not authenticated" error behavior. Verify RLS still protects every path by
temporarily removing one `.eq('user_id', …)` filter and confirming the data
returned is unchanged.
